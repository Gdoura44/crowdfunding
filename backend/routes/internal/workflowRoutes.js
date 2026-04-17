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

const router = express.Router();

function normalizeInternalBody(rawBody) {
  const body = rawBody && typeof rawBody === "object" ? rawBody : {};

  // n8n sometimes wraps BullMQ payload under `data`.
  const data =
    body.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? body.data
      : null;

  // Prefer explicit top-level keys, fall back to `data.*`.
  const merged = { ...(data || {}), ...body };

  // Common naming variants coming from workflow tools.
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
      const result = await analyzeProjectRisk(data);
      const { project, idempotent } =
        await workflowInternalService.updateAiAnalysisFromWorkflow({
          projectId: data.projectId,
          riskScore: result.riskScore,
          riskLevel: result.riskLevel,
          successProbability: result.successProbability,
          analyzedAt: result.analyzedAt,
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
      });
    } catch (err) {
      // Record failure like the n8n failure path would.
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
