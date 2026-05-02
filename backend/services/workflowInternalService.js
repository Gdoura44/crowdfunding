const Project = require("../models/Project");
const FailedWorkflowEvent = require("../models/FailedWorkflowEvent");
const HttpError = require("../utils/HttpError");
const notificationService = require("./notificationService");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { ProjectStatus, AIStatus, transitionProjectStatus } = require("../config/projectLifecycle");
const { enqueueEmailForNotifications } = require("../integrations/emailQueue");
const { searchWebSources } = require("./webSearchService");

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
    throw new HttpError(404, "Projet introuvable.");
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
      "État invalide : le projet doit être en attente d’analyse (AWAITING_AI)."
    );
  }

  const analyzedAt = input.analyzedAt || new Date();
  const sp = Number(input.successProbability ?? project.aiAnalysis?.successProbability);
  const baseReport = input.report || project.aiAnalysis?.report || {};
  const improvements = Array.isArray(baseReport.improvements) ? baseReport.improvements : [];

  // Garder de la marge pour l’interaction utilisateur :
  // - Si successProbability > 75% : ne pas proposer d’“improvements”.
  // - Si successProbability >= 70% : garder seulement 1–2 améliorations.
  // - Sinon : garder jusqu’à 6 améliorations (éviter un rapport trop “parfait”).
  let cappedImprovements = improvements;
  if (Number.isFinite(sp) && sp > 75) cappedImprovements = [];
  else if (Number.isFinite(sp) && sp >= 70) cappedImprovements = improvements.slice(0, 2);
  else cappedImprovements = improvements.slice(0, 6);

  project.aiAnalysis = {
    riskScore: input.riskScore,
    riskLevel: input.riskLevel,
    successProbability:
      input.successProbability ?? project.aiAnalysis?.successProbability,
    analyzedAt,
    report: {
      ...baseReport,
      improvements: cappedImprovements,
    },
    sourcesUsed: Array.isArray(input.sourcesUsed) ? input.sourcesUsed : project.aiAnalysis?.sourcesUsed,
    meta: input.meta || project.aiAnalysis?.meta,
  };
  project.aiStatus = AIStatus.COMPLETED;
  project.aiLastError = "";
  transitionProjectStatus(project, ProjectStatus.UNDER_REVIEW, { action: "AI_ANALYSIS_SUCCESS" });
  await project.save();

  // Notifier le créateur et les admins avec le résumé (court) du rapport pour assurer la transparence.
  const summary = String(input?.report?.summary || "").trim();
  const riskLabel =
    input.riskLevel === "HIGH" ? "élevé" : input.riskLevel === "MEDIUM" ? "moyen" : "faible";

  const creatorNotif = await notificationService.createInAppNotification({
    userId: project.creatorId,
    type: "PROJECT_AI_REPORT_READY",
    title: `Rapport d’analyse IA — ${project.title}`,
    message: summary
      ? `Projet: “${project.title}”. Niveau de risque: ${riskLabel}. ${summary}`
      : `Projet: “${project.title}”. Niveau de risque: ${riskLabel}. Consultez le rapport dans votre projet.`,
    relatedEntityId: project._id,
    relatedEntityType: "PROJECT",
  });

  const admins = await User.find({ role: "ADMIN" }).select("_id").lean();
  let adminNotifs = [];
  if (admins.length) {
    adminNotifs = await Notification.insertMany(
      admins.map((a) => ({
        userId: a._id,
        type: "PROJECT_AI_REPORT_READY",
        title: `Analyse IA prête — ${project.title}`,
        message: summary
          ? `Projet: “${project.title}”. Risque: ${riskLabel}. ${summary}`
          : `Projet: “${project.title}”. Risque: ${riskLabel}. Un rapport IA est disponible.`,
        relatedEntityId: project._id,
        relatedEntityType: "PROJECT",
      }))
    );
  }

  await enqueueEmailForNotifications([creatorNotif, ...adminNotifs]);

  return { project, idempotent: false };
}

/**
 * POST /internal/mark-ai-failed (n8n failure path).
 */
async function markAiAnalysisFailed(input) {
  const project = await Project.findById(input.projectId);
  if (!project) {
    throw new HttpError(404, "Projet introuvable.");
  }

  if (project.status !== ProjectStatus.AWAITING_AI) {
    throw new HttpError(
      409,
      "État invalide : le projet doit être en attente d’analyse (AWAITING_AI)."
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
  // Re-export for queue producers / routes
  searchWebSources,
};
