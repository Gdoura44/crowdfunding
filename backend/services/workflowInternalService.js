const Project = require("../models/Project");
const FailedWorkflowEvent = require("../models/FailedWorkflowEvent");
const HttpError = require("../utils/HttpError");
const notificationService = require("./notificationService");
const { ProjectStatus, AIStatus, transitionProjectStatus } = require("../config/projectLifecycle");

function buildRiskPayload(project) {
  return {
    projectId: String(project._id),
    title: project.title,
    description: project.description,
    category: project.category,
    fundingGoal: project.fundingGoal,
    deadline: project.deadline,
  };
}

/**
 * POST /internal/update-ai-analysis (n8n success path — conception/system sequence diagram/code n8n.txt).
 */
async function updateAiAnalysisFromWorkflow(input) {
  const project = await Project.findById(input.projectId);
  if (!project) {
    throw new HttpError(404, "Project not found");
  }

  if (
    project.status === ProjectStatus.UNDER_REVIEW &&
    project.aiStatus === AIStatus.COMPLETED
  ) {
    return { project, idempotent: true };
  }

  if (project.status !== ProjectStatus.AWAITING_AI) {
    throw new HttpError(
      409,
      "Project must be in AWAITING_AI state to apply AI analysis"
    );
  }

  const analyzedAt = input.analyzedAt || new Date();
  project.aiAnalysis = {
    riskScore: input.riskScore,
    riskLevel: input.riskLevel,
    successProbability:
      input.successProbability ?? project.aiAnalysis?.successProbability,
    analyzedAt,
  };
  project.aiStatus = AIStatus.COMPLETED;
  project.aiLastError = "";
  transitionProjectStatus(project, ProjectStatus.UNDER_REVIEW, { action: "AI_ANALYSIS_SUCCESS" });
  await project.save();

  if (input.riskLevel === "HIGH") {
    await notificationService.createInAppNotification({
      userId: project.creatorId,
      type: "PROJECT_WARNING",
      title: "Alerte risque (IA)",
      message:
        "L’analyse IA indique un niveau de risque élevé. Votre projet passera en revue manuelle.",
      relatedEntityId: project._id,
      relatedEntityType: "PROJECT",
    });
  }

  return { project, idempotent: false };
}

/**
 * POST /internal/mark-ai-failed (n8n failure path).
 */
async function markAiAnalysisFailed(input) {
  const project = await Project.findById(input.projectId);
  if (!project) {
    throw new HttpError(404, "Project not found");
  }

  if (project.status !== ProjectStatus.AWAITING_AI) {
    throw new HttpError(
      409,
      "Project must be in AWAITING_AI state to record AI failure"
    );
  }

  project.aiStatus = AIStatus.FAILED;
  project.aiLastError = String(input.error || "");
  await project.save();

  await FailedWorkflowEvent.create({
    projectId: project._id,
    workflowType: "risk-analysis",
    payload: buildRiskPayload(project),
    error: input.error,
    retryCount: 0,
    resolved: false,
  });

  return { project };
}

module.exports = {
  updateAiAnalysisFromWorkflow,
  markAiAnalysisFailed,
  buildRiskPayload,
};
