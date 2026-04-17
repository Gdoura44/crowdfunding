const axios = require("axios");
const HttpError = require("../utils/HttpError");

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

async function analyzeProjectRisk(payload) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, "GEMINI_API_KEY is not configured on backend");
  }

  const prompt = [
    "Tu es un analyste risque pour une plateforme de crowdfunding.",
    "Réponds STRICTEMENT en JSON avec ces clés:",
    'riskScore (0..100), riskLevel ("LOW"|"MEDIUM"|"HIGH"), successProbability (0..100).',
    "",
    "Projet:",
    `Titre: ${payload.title || ""}`,
    `Description: ${payload.description || ""}`,
    `Catégorie: ${payload.category || ""}`,
    `Objectif: ${payload.fundingGoal ?? ""} TND`,
    `Deadline: ${payload.deadline ? new Date(payload.deadline).toISOString() : ""}`,
  ].join("\n");

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  };

  // Model availability changes over time. Some regions/accounts return 404 for older model ids.
  // We retry with a small set of known "flash" model aliases.
  const preferredModel = String(process.env.GEMINI_MODEL || "").trim();
  const modelCandidates = [
    preferredModel,
    "gemini-flash-latest",
    "gemini-2.0-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
  ].filter(Boolean);

  let resp = null;
  let lastErr = null;
  for (const model of modelCandidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent`;
    try {
      resp = await axios.post(`${url}?key=${encodeURIComponent(apiKey)}`, body, {
        timeout: 45_000,
        headers: { "Content-Type": "application/json" },
      });
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      // Retry only on model-not-found type errors (404), otherwise bubble up.
      const status = err?.response?.status;
      if (status !== 404) {
        throw err;
      }
    }
  }

  if (!resp) {
    const status = lastErr?.response?.status;
    const msg = lastErr?.message || "Gemini request failed";
    throw new HttpError(
      502,
      `Gemini model not available (last status ${status ?? "?"}): ${msg}`
    );
  }

  const text =
    resp?.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    resp?.data?.candidates?.[0]?.content?.parts?.[0]?.text;

  const parsed = extractJsonObject(text);
  if (!parsed) {
    throw new HttpError(502, "Gemini returned an invalid response (no JSON)");
  }

  const riskScore = Number(parsed.riskScore);
  const successProbability = Number(parsed.successProbability);
  const riskLevel = normalizeRiskLevel(parsed.riskLevel);

  if (!Number.isFinite(riskScore) || riskScore < 0 || riskScore > 100) {
    throw new HttpError(502, "Gemini JSON riskScore must be 0..100");
  }
  if (!riskLevel) {
    throw new HttpError(502, "Gemini JSON riskLevel must be LOW|MEDIUM|HIGH");
  }
  if (!Number.isFinite(successProbability) || successProbability < 0 || successProbability > 100) {
    throw new HttpError(502, "Gemini JSON successProbability must be 0..100");
  }

  return {
    riskScore,
    riskLevel,
    successProbability,
    analyzedAt: new Date(),
    rawText: String(text || "").slice(0, 5000),
  };
}

module.exports = { analyzeProjectRisk };

