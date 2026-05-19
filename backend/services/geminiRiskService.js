const axios = require("axios");
const HttpError = require("../utils/HttpError");
const { PLATFORM_FEE_RATE } = require("../config/businessRules");

function extractJsonObject(text) {
  const raw = String(text || "");
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalizeRiskLevel(v) {
  const s = String(v || "").toUpperCase();
  if (["LOW", "MEDIUM", "HIGH"].includes(s)) return s;
  return null;
}

function preferredModelCandidates() {
  const preferredModel = String(process.env.GEMINI_MODEL || "").trim();
  return [
    preferredModel,
    "gemini-flash-latest",
    "gemini-2.0-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
  ].filter(Boolean);
}

async function callGeminiJson({ prompt }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, "Configuration manquante : GEMINI_API_KEY n’est pas défini sur le backend.");
  }

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: String(prompt || "") }],
      },
    ],
  };

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  let resp = null;
  let lastErr = null;
  for (const model of preferredModelCandidates()) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent`;
    // Relance dans le même modèle pour les erreurs transitoires (503/429/timeout).
    // Pourquoi: n8n/BullMQ réessaient déjà, mais 2–3 tentatives internes améliorent
    // le taux de succès sans attendre des minutes.
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        // Timeout progressif : 45s → 70s → 90s
        const timeoutMs = attempt === 1 ? 45_000 : attempt === 2 ? 70_000 : 90_000;
        resp = await axios.post(`${url}?key=${encodeURIComponent(apiKey)}`, body, {
          timeout: timeoutMs,
          headers: { "Content-Type": "application/json" },
        });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        const status = err?.response?.status;
        const isTimeout =
          err?.code === "ECONNABORTED" || /timeout/i.test(String(err?.message || ""));
        const transient = isTimeout || [429, 502, 503, 504].includes(Number(status));

        // On ne change de modèle (secours) que pour les erreurs “model not found” (404).
        if (status === 404) {
          break;
        }
        if (!transient || attempt === 3) {
          throw err;
        }
        // Petit backoff (quasi exponentiel) : 1.5s, 4s
        await sleep(attempt === 1 ? 1500 : 4000);
      }
    }
    if (resp) break;
  }

  if (!resp) {
    const status = lastErr?.response?.status;
    const msg = lastErr?.message || "Requête Gemini échouée";
    throw new HttpError(
      502,
      `Modèle Gemini indisponible (dernier status ${status ?? "?"}) : ${msg}`
    );
  }

  const text =
    resp?.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    resp?.data?.candidates?.[0]?.content?.parts?.[0]?.text;

  return { text: String(text || "").slice(0, 5000) };
}

function requireArrayOfStrings(v, { max = 10 } = {}) {
  const arr = Array.isArray(v) ? v : [];
  return arr
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, max);
}

async function analyzeProjectRisk(payload, { sources: _sources = [] } = {}) {
  const heuristic = payload?.heuristic || null;
  const netGapTnd = Number(heuristic?.breakdown?.goalGap?.gapTnd ?? 0) || 0;
  const netGapPct = Number(heuristic?.breakdown?.goalGap?.gapPct ?? 0) || 0;
  const estimateTnd = Number(heuristic?.breakdown?.goalGap?.estimateTnd ?? 0) || 0;

  const heuristicText = heuristic
    ? [
        "Estimation heuristique (monde réel) calculée par la plateforme:",
        `- successProbabilityHeuristic: ${Number(heuristic.successProbability ?? 0)} (0..100)`,
        `- durationDays: ${Number(heuristic?.breakdown?.durationDays ?? 0)}`,
        `- durationLabel: ${String(heuristic?.breakdown?.duration?.label || "")}`,
        `- goalJustification: ${String(heuristic?.breakdown?.goal?.label || "")}`,
        `- budgetEstimateTnd: ${estimateTnd} TND`,
        `- budgetGapTnd: ${netGapTnd} TND`,
        `- budgetGapPct: ${netGapPct}%`,
        `- budgetGapRule: ${String(heuristic?.breakdown?.gapAssessment?.label || "")}`,
        `- descLen: ${Number(heuristic?.breakdown?.description?.signals?.len ?? 0)}`,
        "",
        "Règles d'évaluation et de Transparence :",
        "1. Alignement : Aligne successProbability sur l'heuristique (±10 pts) sauf justification claire dans summary.",
        "2. Transparence de l'écart : Si le Besoin Réel net du Projet (realBudget) diffère de la somme détaillée dans la description (budgetEstimateTnd) :",
        `   - L'écart net réel non-expliqué est EXACTEMENT de ${netGapTnd} TND (soit ${netGapPct}%). Tu DOIS impérativement utiliser EXACTEMENT ce montant de ${netGapTnd} TND dans ton rapport.`,
        "   - Tu ne dois JAMAIS y ajouter ou mélanger les frais de plateforme. Les frais de plateforme sont automatiques (5%) et n'ont pas à être justifiés par le créateur.",
        `   - Avertissement obligatoire : Rappelle CLAIREMENT au créateur dans ton résumé ('summary') qu'il y a un écart net de EXACTEMENT ${netGapTnd} TND non-expliqué. Dis-lui explicitement que cet écart DOIT être formellement justifié dans la description (ex: logistique, plan B, imprévus) sous peine de rejet automatique du projet.`,
        "   - Si l'objectif net est plus bas : signale le manque de budget et le risque important de sous-financement.",
        "3. Règle bloquante (écart ≥ 25%) : Si 'budgetGapRule' indique un écart ≥ 25% (rejet automatique), alors :",
        "   - La probabilité de succès (successProbability) DOIT être forcée à 0.",
        "   - Le résumé ('summary') DOIT indiquer clairement que le projet est rejeté automatiquement pour incohérence budgétaire tant que ce point n'est pas corrigé.",
        "",
      ].join("\n")
    : "";

  const prompt = [
    "Tu es un analyste risque pour une plateforme de crowdfunding.",
    "Ta mission: produire un rapport COURT et actionnable pour le créateur et l'admin.",
    "",
    "Contraintes IMPORTANTES:",
    "- Réponds STRICTEMENT en JSON (pas de texte hors JSON).",
    "- Pas d'accusations (pas de \"fraude\"), seulement des signaux et points à clarifier.",
    "",
    heuristicText,
    "JSON attendu (clés obligatoires):",
    'riskScore (0..100), riskLevel ("LOW"|"MEDIUM"|"HIGH"), successProbability (0..100),',
    "summary (max 350 chars),",
    "advantages (max 4 items), disadvantages (max 4 items),",
    "improvements (max 4 items), removals (max 4 items), questionsToClarify (max 4 items),",
    "",
    "Projet:",
    `Titre: ${payload.title || ""}`,
    `Description: ${payload.description || ""}`,
    `Catégorie: ${payload.category || ""}`,
    `Objectif Public de la Campagne (frais inclus): ${payload.fundingGoal ?? ""} TND`,
    `Besoin Réel net du Projet (reçu par le créateur): ${payload.realBudget ?? (payload.fundingGoal ? Math.round(payload.fundingGoal * (1 - PLATFORM_FEE_RATE)) : "")} TND`,
    `Deadline: ${payload.deadline ? new Date(payload.deadline).toISOString() : ""}`,
  ].join("\n");

  const { text } = await callGeminiJson({ prompt });
  const parsed = extractJsonObject(text);
  if (!parsed) {
    throw new HttpError(502, "Gemini a renvoyé une réponse invalide (JSON introuvable).");
  }

  const riskScore = Number(parsed.riskScore);
  const successProbability = Number(parsed.successProbability);
  const riskLevel = normalizeRiskLevel(parsed.riskLevel);

  if (!Number.isFinite(riskScore) || riskScore < 0 || riskScore > 100) {
    throw new HttpError(502, "Gemini: champ JSON riskScore doit être entre 0 et 100.");
  }
  if (!riskLevel) {
    throw new HttpError(502, "Gemini: champ JSON riskLevel doit être LOW|MEDIUM|HIGH.");
  }
  if (!Number.isFinite(successProbability) || successProbability < 0 || successProbability > 100) {
    throw new HttpError(502, "Gemini: champ JSON successProbability doit être entre 0 et 100.");
  }

  const summary = String(parsed.summary || "").trim().slice(0, 350);

  return {
    riskScore,
    riskLevel,
    successProbability,
    analyzedAt: new Date(),
    report: {
      summary,
      advantages: requireArrayOfStrings(parsed.advantages, { max: 6 }),
      disadvantages: requireArrayOfStrings(parsed.disadvantages, { max: 6 }),
      improvements: requireArrayOfStrings(parsed.improvements, { max: 8 }),
      removals: requireArrayOfStrings(parsed.removals, { max: 6 }),
      questionsToClarify: requireArrayOfStrings(parsed.questionsToClarify, { max: 6 }),
    },
    rawText: String(text || "").slice(0, 5000),
  };
}

module.exports = { analyzeProjectRisk };

