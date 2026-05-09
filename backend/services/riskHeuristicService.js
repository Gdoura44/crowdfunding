function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  const d1 = new Date(a);
  const d2 = new Date(b);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
  const ms = d2.getTime() - d1.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function scoreDurationCoherence({ durationDays, description }) {
  // On ne score pas une durée par des seuils absolus (dépend du domaine).
  // On vérifie surtout la cohérence: si le projet est long, la description doit contenir un plan/jalons.
  if (!Number.isFinite(durationDays)) return { score: 65, label: "durée inconnue" };
  const text = String(description || "");
  const lower = text.toLowerCase();
  const hasPlanSignals = /plan|jalon|étape|etape|semaine|mois|calendrier|phase/.test(lower);

  // Si la durée est longue et qu’un plan manque, on le signale légèrement.
  if (durationDays >= 120 && !hasPlanSignals) {
    return { score: 55, label: "durée longue: plan/jalons à préciser" };
  }
  return { score: 75, label: hasPlanSignals ? "durée cohérente avec un plan" : "durée cohérente" };
}

function scoreGoalJustification({ fundingGoal, description }) {
  // On ne juge jamais l’objectif sur son montant absolu (dépend du domaine).
  // On juge si l’objectif est *expliqué* et *détaillé* dans la description.
  const g = Number(fundingGoal);
  const text = String(description || "");
  const lower = text.toLowerCase();
  const hasBudgetSection = /budget|utilisation des fonds|répartition|repartition/.test(lower);
  const hasCurrency = /tnd|dinars|dt\b/.test(lower);
  const hasNumbers = /\d{2,}/.test(text); // some numeric detail
  const hasLineItems = (text.match(/\n-\s.*\d+/g) || []).length >= 2;
  const goalProvided = Number.isFinite(g) && g > 0;

  let score = 55;
  if (!goalProvided) return { score: 45, label: "objectif manquant" };
  if (hasBudgetSection) score += 15;
  if (hasNumbers) score += 10;
  if (hasCurrency) score += 8;
  if (hasLineItems) score += 7;
  if (!hasBudgetSection && !hasNumbers) score -= 10;
  return { score: clamp(score, 30, 95), label: hasBudgetSection ? "objectif justifié" : "objectif peu justifié" };
}

/**
 * Heuristique “expliquable” pour guider l’analyse IA (et stabiliser l’expérience).
 *
 * Idée clé (PFE):
 * - on n’évalue pas un projet par des montants/durées absolus (ça dépend du domaine),
 * - on évalue la cohérence et la transparence dans la description (plan, budget, risques),
 * - et on explique l’écart entre l’objectif (fundingGoal) et une estimation issue du texte.
 *
 * Cette heuristique sert de garde-fou: elle donne une base déterministe,
 * puis le LLM produit un rapport lisible pour l’utilisateur.
 */
function normalizeTndNumber(raw) {
  const s = String(raw || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, "")
    .replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function estimateBudgetFromDescription(description) {
  const text = String(description || "");
  const lines = text.split(/\r?\n/);

  // Se concentrer sur les lignes “budget” : monnaie/budget ou listes à puces.
  const budgetish = lines.filter((l) => /budget|tnd|\bdt\b|dinars?/i.test(l) || /^\s*-\s+/.test(l));

  let sum = 0;
  let count = 0;
  for (const l of budgetish) {
    const line = String(l || "");
    // Ne jamais compter les lignes de total (sinon on double-compte).
    // Ex: "Total : 13 250 TND" ou "Total > 10 000 TND"
    if (/\btotal\b/i.test(line)) continue;
    const hasCurrency = /(tnd|\bdt\b|dinars?)/i.test(line);

    // Règle 1 (préférée): si la ligne contient "=", on prend le montant APRÈS "="
    // car c'est généralement le total du poste (évite de compter quantité et prix unitaire).
    // Exemple: "3 × 350 = 1 050 TND" => 1050
    if (hasCurrency && /=/.test(line)) {
      const rhs = line.split("=").slice(1).join("=").trim();
      const mEq = rhs.match(/(\d[\d\s]{1,})\s*(tnd|\bdt\b|dinars?)?/i);
      if (mEq && mEq[1]) {
        const n = normalizeTndNumber(mEq[1]);
        if (n != null) {
          sum += n;
          count += 1;
          continue;
        }
      }
    }

    // Règle 2: montant explicite suivi d'une devise.
    // Exemples: "7 800 TND", "7800TND", "7800 DT"
    if (hasCurrency) {
      const m = line.match(/(\d[\d\s]{1,})\s*(tnd|\bdt\b|dinars?)/i);
      if (m && m[1]) {
        const n = normalizeTndNumber(m[1]);
        if (n != null) {
          sum += n;
          count += 1;
          continue;
        }
      }
    }

    // Important: ne pas “deviner” sur les lignes à puces sans devise.
    // Sinon on additionne des nombres non-budgétaires (ex: "2000L", "Semaine 6", "450 élèves", etc.)
  }

  if (count < 2) return { estimateTnd: null, lineItemsDetected: count };
  return { estimateTnd: Math.round(sum), lineItemsDetected: count };
}

function computeGoalGap({ fundingGoal, description }) {
  const goal = Number(fundingGoal);
  if (!Number.isFinite(goal) || goal <= 0) {
    return { estimateTnd: null, gapTnd: null, gapPct: null, lineItemsDetected: 0 };
  }
  const est = estimateBudgetFromDescription(description);
  if (!Number.isFinite(est.estimateTnd)) {
    return { estimateTnd: null, gapTnd: null, gapPct: null, lineItemsDetected: est.lineItemsDetected };
  }
  const gapTnd = Math.round(goal - est.estimateTnd);
  const gapPct = est.estimateTnd > 0 ? Math.round((gapTnd / est.estimateTnd) * 100) : null;
  return { estimateTnd: est.estimateTnd, gapTnd, gapPct, lineItemsDetected: est.lineItemsDetected };
}

function assessGoalGapCoherence({ goalGap, description }) {
  const estimateTnd = Number(goalGap?.estimateTnd);
  const gapPct = Number(goalGap?.gapPct);
  if (!Number.isFinite(estimateTnd) || estimateTnd <= 0 || !Number.isFinite(gapPct)) {
    return {
      severity: "UNKNOWN",
      forcedSuccessProbability: null,
      deltaSuccessProbability: 0,
      label: "écart budget non évalué",
    };
  }

  const absPct = Math.abs(gapPct);
  const lower = String(description || "").toLowerCase();
  const hasJustificationKeywords =
    /marge|imprévu|imprevu|réserve|reserve|contingence|plan b|surplus|sécurité|securite|stock|tampon/.test(lower);
  const hasBudgetSignals = /budget|utilisation des fonds|répartition|repartition/.test(lower);
  const hasEnoughLineItems = Number(goalGap?.lineItemsDetected || 0) >= 2;
  const isDetailedExplanation = hasBudgetSignals && hasEnoughLineItems && hasJustificationKeywords;
  const isExplained = hasBudgetSignals && hasEnoughLineItems;

  // Règle demandée:
  // - écart <= 20% + explication détaillée => OK
  // - 20% < écart <= 30% => warning + baisse légère
  // - écart ≥ 30% => rejet automatique (trop grand écart = confiance contributeurs)

  if (absPct >= 30) {
    return {
      severity: "BLOCK",
      forcedSuccessProbability: 0,
      deltaSuccessProbability: 0,
      label: "écart ≥ 30% : rejet automatique (objectif vs besoins)",
      adminLikelyReject: true,
    };
  }

  if (absPct > 20) {
    if (!isExplained) {
      return {
        severity: "WARN",
        forcedSuccessProbability: null,
        // Transparence: sans explication, l'impact doit être fort.
        deltaSuccessProbability: -25,
        label: "écart 20–30% : manque d’explication (impact fort)",
        adminLikelyReject: false,
      };
    }
    return {
      severity: "WARN",
      forcedSuccessProbability: null,
      // Explication présente => impact modéré.
      deltaSuccessProbability: -10,
      label: isDetailedExplanation
        ? "écart 20–30% : marge à surveiller (expliquée)"
        : "écart 20–30% : marge à justifier",
      adminLikelyReject: false,
    };
  }

  // absPct <= 20
  if (isDetailedExplanation) {
    return {
      severity: "OK",
      forcedSuccessProbability: null,
      deltaSuccessProbability: 0,
      label: "écart ≤ 20% : cohérent (expliqué)",
      adminLikelyReject: false,
    };
  }

  if (!isExplained) {
    return {
      severity: "LOW",
      forcedSuccessProbability: null,
      // Transparence: même un petit écart doit être expliqué => impact important.
      deltaSuccessProbability: -15,
      label: "écart ≤ 20% : non expliqué (impact fort)",
      adminLikelyReject: false,
    };
  }

  return {
    severity: "LOW",
    forcedSuccessProbability: null,
    deltaSuccessProbability: -6,
    label: "écart ≤ 20% : à expliquer (marge/buffer)",
    adminLikelyReject: false,
  };
}

function scoreDescriptionQuality(description) {
  const text = String(description || "");
  const len = text.trim().length;
  // Signals: length + structure keywords (budget, plan, risques).
  const lower = text.toLowerCase();
  const hasBudget = /budget|tnd|dinars|coût|cout/.test(lower);
  const hasPlan = /plan|jalon|étape|etape|semaine|mois/.test(lower);
  const hasRisks = /risque|atténuation|attenuation|plan b/.test(lower);
  const bullets = (text.match(/\n-\s/g) || []).length;
  let base = 40;
  if (len >= 1200) base = 85;
  else if (len >= 700) base = 75;
  else if (len >= 350) base = 62;
  else if (len >= 150) base = 52;
  base += hasBudget ? 5 : 0;
  base += hasPlan ? 5 : 0;
  base += hasRisks ? 5 : 0;
  base += bullets >= 6 ? 3 : 0;
  return {
    score: clamp(base, 20, 95),
    signals: { len, hasBudget, hasPlan, hasRisks, bullets },
  };
}

/**
 * Compute a deterministic, explainable success estimate (0..100).
 *
 * Weights (sum = 100):
 * - 20% Duration (only extremes; domain-agnostic)
 * - 40% Goal justification (not the amount; the explanation)
 * - 40% Description quality & transparency (plan/budget/risks)
 *
 * Pourquoi: sans données externes, les signaux les plus fiables sont la clarté,
 * la transparence et la cohérence (pas le montant absolu).
 */
function computeSuccessHeuristic({ startAt, deadline, fundingGoal, description }) {
  const durationDays = daysBetween(startAt, deadline);
  const duration = scoreDurationCoherence({ durationDays, description });
  const goal = scoreGoalJustification({ fundingGoal, description });
  const desc = scoreDescriptionQuality(description);
  const goalGap = computeGoalGap({ fundingGoal, description });
  const gapAssessment = assessGoalGapCoherence({ goalGap, description });

  const successProbability = Math.round(
    0.45 * goal.score + 0.55 * desc.score
  );
  const forced = gapAssessment?.forcedSuccessProbability;
  const delta = Number(gapAssessment?.deltaSuccessProbability || 0);
  const adjusted =
    Number.isFinite(forced) && forced != null ? Number(forced) : successProbability + delta;

  return {
    successProbability: clamp(adjusted, 0, 100),
    breakdown: {
      // La durée sert uniquement à la cohérence (pas un facteur direct du score).
      weights: { goalJustification: 0.45, description: 0.55 },
      durationDays,
      duration,
      goal,
      goalGap,
      gapAssessment,
      description: desc,
    },
  };
}

module.exports = { computeSuccessHeuristic };

