const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const HttpError = require("../../utils/HttpError");
const {
  updateAiAnalysisSchema,
  markAiFailedSchema,
  runRiskAnalysisSchema,
} = require("../../validators/internalSchemas");
const workflowInternalService = require("../../services/workflowInternalService");
const { analyzeProjectRisk } = require("../../services/geminiRiskService");
const { computeSuccessHeuristic } = require("../../services/riskHeuristicService");
const Project = require("../../models/Project");
const notificationService = require("../../services/notificationService");
const { enqueueEmailForNotification } = require("../../integrations/emailQueue");
const { ProjectStatus, AIStatus, transitionProjectStatus } = require("../../config/projectLifecycle");

const router = express.Router();

/**
 * Normalise les payloads venant des outils d’orchestration (n8n/BullMQ).
 *
 * Pourquoi:
 * - selon les nodes, le payload peut être dans `body.data` ou en top-level.
 * - on tolère quelques variantes (projectID/projectid) pour éviter des jobs “cassés”.
 */
function normalizeInternalBody(rawBody) {
  const body = rawBody && typeof rawBody === "object" ? rawBody : {};

  // n8n sometimes wraps BullMQ payload under `data`.
  const data =
    body.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? body.data
      : null;

  // Prefer explicit top-level keys, fall back to `data.*`.
  const merged = { ...(data || {}), ...body };

  // Variantes de nommage couramment renvoyées par les outils de workflow (n8n, Zapier, etc.).
  if (merged.projectId == null && merged.projectid != null) {
    merged.projectId = merged.projectid;
  }
  if (merged.projectId == null && merged.projectID != null) {
    merged.projectId = merged.projectID;
  }

  return merged;
}

function parseBody(schema, body) {
  const normalized = normalizeInternalBody(body);
  const result = schema.safeParse(normalized);
  if (!result.success) {
    throw new HttpError(400, "Validation failed", result.error.flatten());
  }
  return result.data;
}

router.all("/run-risk-analysis", (req, res, next) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      message: "Method not allowed",
      allowed: ["POST"],
    });
  }
  return next();
});

router.post(
  "/run-risk-analysis",
  asyncHandler(async (req, res) => {
    const data = parseBody(runRiskAnalysisSchema, req.body);
    try {
      // Web research disabled: better UX + fewer tokens/quota.
      const sources = [];

      // Heuristic estimate (deterministic, explainable)
      const heuristic = computeSuccessHeuristic({
        startAt: new Date(),
        deadline: data.deadline,
        fundingGoal: data.fundingGoal,
        description: data.description,
      });

      const gapAssessment = heuristic?.breakdown?.gapAssessment || null;
      const shouldAutoReject = gapAssessment?.severity === "BLOCK";
      if (shouldAutoReject) {
        const project = await Project.findById(data.projectId);
        if (!project) throw new HttpError(404, "Projet introuvable.");

        // Idempotent: si déjà rejeté automatiquement, répondre OK sans refaire le traitement.
        if (project.status === ProjectStatus.REJECTED && project.aiStatus === AIStatus.COMPLETED) {
          return res.json({
            ok: true,
            idempotent: true,
            project: {
              _id: project._id,
              status: project.status,
              aiStatus: project.aiStatus,
              aiAnalysis: project.aiAnalysis,
            },
            sourcesCount: 0,
          });
        }

        if (project.status !== ProjectStatus.AWAITING_AI) {
          throw new HttpError(
            409,
            "État invalide : le projet doit être en attente d’analyse (AWAITING_AI)."
          );
        }

        const gapPct = Number(heuristic?.breakdown?.goalGap?.gapPct || 0);
        const estimateTnd = Number(heuristic?.breakdown?.goalGap?.estimateTnd || 0);
        const fundingGoal = Number(data.fundingGoal || 0);
        const gapTnd = Math.round(Math.abs(fundingGoal - estimateTnd));

        const reason =
          `Décision automatique : rejet pour incohérence budgétaire (écart ≥ 30%). ` +
          `Objectif annoncé : ${fundingGoal || "N/A"} TND. Besoin estimé (à partir de la description) : ${estimateTnd || "N/A"} TND. ` +
          `Écart estimé : ${gapTnd} TND (${Math.round(Math.abs(gapPct))}%). ` +
          `Pour rassurer les contributeurs, merci de (1) détailler le budget avec des postes chiffrés (3–6 lignes), ` +
          `(2) expliquer l’écart et l’usage de la marge (imprévus/réserve/plan B), puis (3) renvoyer le projet.`;

        project.aiAnalysis = {
          riskScore: 100,
          riskLevel: "HIGH",
          successProbability: 0,
          analyzedAt: new Date(),
          report: {
            summary: String(gapAssessment?.label || "").trim() || "Incohérence budgétaire bloquante.",
            advantages: [],
            disadvantages: [
              "Écart important entre l’objectif de financement et l’estimation des besoins issue de la description.",
              "Absence de justification suffisamment claire et chiffrée de la marge budgétaire.",
            ],
            improvements: [
              "Ajouter une section Budget avec 3–6 postes chiffrés (matériel, logistique, communication, etc.).",
              "Expliquer explicitement la marge (imprévus, réserve, plan B) et comment elle sera utilisée.",
            ],
            removals: [],
            questionsToClarify: [
              "Quels postes expliquent l’écart entre besoins estimés et objectif ?",
              "Que se passe-t-il si une partie du budget n’est pas utilisée ?",
            ],
          },
          sourcesUsed: [],
          meta: { method: "heuristic-only:auto-reject", model: "N/A" },
        };
        project.aiStatus = AIStatus.COMPLETED;
        project.aiLastError = "";
        transitionProjectStatus(project, ProjectStatus.REJECTED, { action: "AI_AUTO_REJECT_GOAL_GAP" });
        project.rejectionReason = reason;
        project.rejectedAt = new Date();
        project.rejectedBy = undefined;
        await project.save();

        try {
          const notif = await notificationService.createInAppNotification({
            userId: project.creatorId,
            type: "PROJECT_AUTO_REJECTED",
            title: `Projet rejeté automatiquement — ${project.title}`,
            message: reason,
            relatedEntityId: project._id,
            relatedEntityType: "PROJECT",
          });
          await enqueueEmailForNotification(notif);
        } catch {
          // ignorer (au mieux)
        }

        return res.json({
          ok: true,
          idempotent: false,
          project: {
            _id: project._id,
            status: project.status,
            aiStatus: project.aiStatus,
            aiAnalysis: project.aiAnalysis,
          },
          sourcesCount: 0,
        });
      }

      const result = await analyzeProjectRisk({ ...data, heuristic }, { sources });
      const { project, idempotent } =
        await workflowInternalService.updateAiAnalysisFromWorkflow({
          projectId: data.projectId,
          riskScore: result.riskScore,
          riskLevel: result.riskLevel,
          successProbability: result.successProbability,
          analyzedAt: result.analyzedAt,
          report: result.report,
          sourcesUsed: sources,
          meta: {
            method: "heuristic+llm",
            model: String(process.env.GEMINI_MODEL || "").trim() || "auto",
          },
        });
      res.json({
        ok: true,
        idempotent: Boolean(idempotent),
        project: {
          _id: project._id,
          status: project.status,
          aiStatus: project.aiStatus,
          aiAnalysis: project.aiAnalysis,
        },
        sourcesCount: 0,
      });
    } catch (err) {
      /**
       * Gestion des erreurs IA (quota/timeout/503...):
       * - transitoire => on enregistre un backoff (aiNextRetryAt/aiAutoRetryCount) pour UX + cron,
       *   puis on renvoie 429/503 afin que n8n/BullMQ réessaie sans marquer le projet FAILED.
       * - non transitoire => on marque FAILED (audit + dead-letter) via workflowInternalService.
       */
      // Si Gemini/web est temporairement indisponible, laisser BullMQ/n8n relancer le job
      // sans marquer le projet FAILED trop tôt.
      const upstreamStatus =
        err?.response?.status ||
        err?.statusCode ||
        err?.status ||
        err?.output?.statusCode;
      const isTimeout =
        err?.code === "ECONNABORTED" ||
        /timeout/i.test(String(err?.message || "")) ||
        /timed out/i.test(String(err?.message || ""));
      const isQuota = Number(upstreamStatus) === 429;
      const transient = isTimeout || [429, 502, 503, 504].includes(Number(upstreamStatus));
      if (transient) {
        // Enregistrer l’état transitoire pour améliorer l’UX / le backoff (ne pas marquer FAILED définitivement).
        try {
          const p = await Project.findById(data.projectId).select("aiAutoRetryCount").lean();
          const n = Math.max(Number(p?.aiAutoRetryCount || 0), 0);
          const nextCount = Math.min(n + 1, 20);
          const delayMin = isQuota ? Math.min(60, 5 * Math.pow(2, Math.min(nextCount, 4))) : Math.min(20, 2 * nextCount);
          await Project.updateOne(
            { _id: data.projectId },
            {
              $set: {
                aiLastError: isQuota ? "AI_QUOTA_EXCEEDED" : "AI_TEMPORARY_FAILURE",
                aiNextRetryAt: new Date(Date.now() + delayMin * 60 * 1000),
              },
              $inc: { aiAutoRetryCount: 1 },
            }
          );
        } catch {
          // au mieux
        }
        if (isQuota) {
          const retryDelayRaw =
            err?.response?.data?.error?.details?.find?.((d) => d?.["@type"]?.includes?.("RetryInfo"))
              ?.retryDelay || "";
          const retryAfterSeconds = Number(String(retryDelayRaw).replace(/s$/i, "")) || null;
          throw new HttpError(
            429,
            "AI quota exceeded (retry later)",
            { upstreamStatus: 429, retryAfterSeconds },
            "AI_QUOTA_EXCEEDED"
          );
        }
        throw new HttpError(
          503,
          "AI service temporarily unavailable (retry later)",
          { upstreamStatus: Number(upstreamStatus) || null, timeout: Boolean(isTimeout) },
          "AI_TEMPORARY_FAILURE"
        );
      }

      // Enregistrer un échec permanent, comme le ferait la branche d’échec côté n8n.
      await workflowInternalService.markAiAnalysisFailed({
        projectId: data.projectId,
        error: String(err?.message || err),
      });
      throw err;
    }
  })
);

router.post(
  "/update-ai-analysis",
  asyncHandler(async (req, res) => {
    const data = parseBody(updateAiAnalysisSchema, req.body);
    const { project, idempotent } =
      await workflowInternalService.updateAiAnalysisFromWorkflow(data);
    res.json({
      ok: true,
      idempotent: Boolean(idempotent),
      project: {
        _id: project._id,
        status: project.status,
        aiStatus: project.aiStatus,
        aiAnalysis: project.aiAnalysis,
      },
    });
  })
);

router.post(
  "/mark-ai-failed",
  asyncHandler(async (req, res) => {
    const data = parseBody(markAiFailedSchema, req.body);
    const { project } = await workflowInternalService.markAiAnalysisFailed(data);
    res.status(201).json({
      ok: true,
      project: {
        _id: project._id,
        status: project.status,
        aiStatus: project.aiStatus,
      },
    });
  })
);

module.exports = router;
