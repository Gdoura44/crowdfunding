const mongoose = require("mongoose");
const Project = require("../models/Project");
const AuditLog = require("../models/AuditLog");
const Notification = require("../models/Notification");
const HttpError = require("../utils/HttpError");
const { enqueueEmailForNotifications } = require("../integrations/emailQueue");
const { withOptionalTransaction } = require("../utils/withOptionalTransaction");
const { enqueueRiskAnalysisJob } = require("../integrations/riskAnalysisQueue");
const FailedRefundEvent = require("../models/FailedRefundEvent");
const Investment = require("../models/Investment");
const {
  ProjectStatus,
  AIStatus,
  canAdminRetryAi,
  canSuspendProject,
  transitionProjectStatus,
} = require("../config/projectLifecycle");
const payoutService = require("./payoutService");

function isAiAnalysisFresh(project, { maxAgeDays = 30 } = {}) {
  const analyzedAt = project?.aiAnalysis?.analyzedAt;
  if (!analyzedAt) return false;
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  return new Date(analyzedAt) >= cutoff;
}

async function listAdminProjects({ status, limit = 30 } = {}) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 30;

  const query = {};
  if (status) query.status = String(status);
  return Project.find(query).sort({ updatedAt: -1 }).limit(safeLimit).lean();
}

async function validateProject({
  adminId,
  projectId,
  decision,
  feedback = "",
}) {
  if (!mongoose.isValidObjectId(projectId)) {
    throw new HttpError(400, "Identifiant de projet invalide.");
  }
  const normalizedDecision = String(decision || "").toUpperCase();
  if (!["APPROVED", "REJECTED"].includes(normalizedDecision)) {
    throw new HttpError(400, "Décision invalide. Valeurs attendues : APPROVED ou REJECTED.");
  }

  const project = await Project.findById(projectId);
  if (!project) throw new HttpError(404, "Projet introuvable.");

  if (project.status !== "UNDER_REVIEW") {
    throw new HttpError(
      409,
      "État invalide : le projet doit être en cours de revue (UNDER_REVIEW).",
      { expected: ProjectStatus.UNDER_REVIEW, actual: project.status },
      "INVALID_PROJECT_STATE"
    );
  }
  if (project.aiStatus !== AIStatus.COMPLETED || !project.aiAnalysis) {
    throw new HttpError(
      400,
      "Analyse IA non terminée. Merci d’attendre la fin de l’analyse (ou relancer en cas d’échec)."
    );
  }
  if (!isAiAnalysisFresh(project, { maxAgeDays: 30 })) {
    throw new HttpError(400, "Analyse IA trop ancienne. Relancez l’analyse avant la validation.");
  }
  if (project.deadline && new Date(project.deadline) < new Date()) {
    throw new HttpError(
      400,
      "Date limite dépassée. Vous ne pouvez plus valider ce projet dans l’état actuel."
    );
  }

  let createdNotifications = [];
  const updatedProject = await withOptionalTransaction(async (session) => {
    if (normalizedDecision === "APPROVED") {
      transitionProjectStatus(project, ProjectStatus.APPROVED, { action: "ADMIN_APPROVE_PROJECT" });
      await project.save(session ? { session } : undefined);

      await AuditLog.create(
        [
          {
            actorId: adminId,
            actorRole: "ADMIN",
            action: "VALIDATE_PROJECT",
            targetType: "Project",
            targetId: project._id,
            details: { decision: "APPROVED", feedback: feedback || "" },
          },
        ],
        session ? { session } : undefined
      );

      createdNotifications = await Notification.create(
        [
          {
            userId: project.creatorId,
            type: "PROJECT_APPROVED",
            title: `Projet approuvé — ${project.title}`,
            message:
              `Bonne nouvelle : votre projet “${project.title}” a été approuvé. Un administrateur peut maintenant le publier pour l’ouvrir aux investissements.`,
            relatedEntityId: project._id,
            relatedEntityType: "PROJECT",
          },
        ],
        session ? { session } : undefined
      );
    } else {
      transitionProjectStatus(project, ProjectStatus.REJECTED, { action: "ADMIN_REJECT_PROJECT" });
      project.rejectionReason = String(feedback || "").trim();
      project.rejectedBy = adminId;
      project.rejectedAt = new Date();
      await project.save(session ? { session } : undefined);

      await AuditLog.create(
        [
          {
            actorId: adminId,
            actorRole: "ADMIN",
            action: "VALIDATE_PROJECT",
            targetType: "Project",
            targetId: project._id,
            details: { decision: "REJECTED", feedback: feedback || "" },
          },
        ],
        session ? { session } : undefined
      );

      createdNotifications = await Notification.create(
        [
          {
            userId: project.creatorId,
            type: "PROJECT_REJECTED",
            title: `Projet à corriger — ${project.title}`,
            message:
              `Votre projet “${project.title}” n’a pas été validé pour le moment. Vous pouvez le modifier puis le renvoyer pour révision.` +
              (project.rejectionReason ? ` Raison: ${project.rejectionReason}` : ""),
            relatedEntityId: project._id,
            relatedEntityType: "PROJECT",
          },
        ],
        session ? { session } : undefined
      );
    }
    return project.toObject();
  });

  await enqueueEmailForNotifications(createdNotifications);
  return updatedProject;
}

async function publishProject({ adminId, projectId }) {
  if (!mongoose.isValidObjectId(projectId)) {
    throw new HttpError(400, "Identifiant de projet invalide.");
  }
  const project = await Project.findById(projectId);
  if (!project) throw new HttpError(404, "Projet introuvable.");
  if (project.status !== "APPROVED") {
    throw new HttpError(
      409,
      "État invalide : le projet doit être approuvé (APPROVED) pour être publié.",
      { expected: ProjectStatus.APPROVED, actual: project.status },
      "INVALID_PROJECT_STATE"
    );
  }

  let createdNotifications = [];
  const updatedProject = await withOptionalTransaction(async (session) => {
    transitionProjectStatus(project, ProjectStatus.ACTIVE, { action: "ADMIN_PUBLISH_PROJECT" });
    project.publishedAt = new Date();
    await project.save(session ? { session } : undefined);

    await AuditLog.create(
      [
        {
          actorId: adminId,
          actorRole: "ADMIN",
          action: "PUBLISH_PROJECT",
          targetType: "Project",
          targetId: project._id,
          details: {},
        },
      ],
      session ? { session } : undefined
    );

    createdNotifications = await Notification.create(
      [
        {
          userId: project.creatorId,
          type: "PROJECT_PUBLISHED",
          title: `Projet en ligne — ${project.title}`,
          message:
            `Votre projet “${project.title}” est maintenant visible publiquement et ouvert aux investissements.`,
          relatedEntityId: project._id,
          relatedEntityType: "PROJECT",
        },
      ],
      session ? { session } : undefined
    );
    return project.toObject();
  });

  await enqueueEmailForNotifications(createdNotifications);
  return updatedProject;
}

async function revokeApproval({ adminId, projectId, reason = "" }) {
  if (!mongoose.isValidObjectId(projectId)) {
    throw new HttpError(400, "Identifiant de projet invalide.");
  }
  const project = await Project.findById(projectId);
  if (!project) throw new HttpError(404, "Projet introuvable.");
  if (project.status !== "APPROVED") {
    throw new HttpError(
      409,
      "État invalide : le projet doit être approuvé (APPROVED) pour annuler l’approbation.",
      { expected: ProjectStatus.APPROVED, actual: project.status },
      "INVALID_PROJECT_STATE"
    );
  }

  const r = String(reason || "").trim();
  if (!r) {
    throw new HttpError(
      400,
      "Veuillez indiquer ce qui doit être corrigé (motif obligatoire) avant de renvoyer le projet."
    );
  }

  let createdNotifications = [];
  const updatedProject = await withOptionalTransaction(async (session) => {
    transitionProjectStatus(project, ProjectStatus.REJECTED, { action: "ADMIN_REVOKE_APPROVAL" });
    project.rejectionReason = r;
    project.rejectedBy = adminId;
    project.rejectedAt = new Date();
    await project.save(session ? { session } : undefined);

    await AuditLog.create(
      [
        {
          actorId: adminId,
          actorRole: "ADMIN",
          action: "REVOKE_APPROVAL",
          targetType: "Project",
          targetId: project._id,
          details: { reason: r },
        },
      ],
      session ? { session } : undefined
    );

    createdNotifications = await Notification.create(
      [
        {
          userId: project.creatorId,
          type: "PROJECT_REJECTED",
          title: `Corrections requises — ${project.title}`,
          message:
            `Votre projet “${project.title}” nécessite des corrections avant publication.\n\nMotif: ${r}\n\nMerci de modifier le projet puis de le renvoyer pour revue.`,
          relatedEntityId: project._id,
          relatedEntityType: "PROJECT",
        },
      ],
      session ? { session } : undefined
    );

    return project.toObject();
  });

  await enqueueEmailForNotifications(createdNotifications);
  return updatedProject;
}

async function retryAiAnalysis({ adminId, projectId }) {
  if (!mongoose.isValidObjectId(projectId)) {
    throw new HttpError(400, "Identifiant de projet invalide.");
  }
  const project = await Project.findById(projectId);
  if (!project) throw new HttpError(404, "Projet introuvable.");

  if (project.aiAnalysisRetries >= 3) {
    throw new HttpError(400, "Limite de relance atteinte (3 tentatives).");
  }

  if (!canAdminRetryAi(project)) {
    throw new HttpError(
      409,
      "Relance impossible dans l’état actuel du projet.",
      { actual: project.status },
      "INVALID_PROJECT_STATE"
    );
  }

  transitionProjectStatus(project, ProjectStatus.AWAITING_AI, { action: "ADMIN_RETRY_AI" });
  project.aiStatus = AIStatus.PENDING;
  project.aiJobId = "";
  project.aiQueuedAt = new Date();
  project.aiLastError = "";
  project.aiAnalysisRetries = Number(project.aiAnalysisRetries || 0) + 1;
  await project.save();

  try {
    const enq = await enqueueRiskAnalysisJob(project);
    if (enq && enq.queued && enq.jobId) {
      project.aiJobId = String(enq.jobId);
      await project.save();
    }
  } catch {
    // Mise en file best-effort (mode stub si REDIS_URL manquant)
  }

  await AuditLog.create({
    actorId: adminId,
    actorRole: "ADMIN",
    action: "RETRY_AI_ANALYSIS",
    targetType: "Project",
    targetId: project._id,
    details: { aiAnalysisRetries: project.aiAnalysisRetries },
  });

  return project.toObject();
}

async function deactivateProject({ adminId, projectId, reason = "" }) {
  if (!mongoose.isValidObjectId(projectId)) {
    throw new HttpError(400, "Identifiant de projet invalide.");
  }
  const project = await Project.findById(projectId);
  if (!project) throw new HttpError(404, "Projet introuvable.");
  if (project.isArchived) {
    throw new HttpError(400, "Projet archivé : suspension impossible.");
  }
  if (!canSuspendProject(project.status)) {
    throw new HttpError(
      409,
      "Suspension impossible dans l’état actuel du projet.",
      { actual: project.status },
      "INVALID_PROJECT_STATE"
    );
  }

  const scheduled = await Investment.findOne({
    projectId: project._id,
    scheduledForDeactivation: true,
  }).lean();
  if (scheduled) {
    throw new HttpError(400, "Action impossible : des investissements sont encore en cours de traitement.");
  }

  const normalizedReason = String(reason || "").trim();
  const suspensionMessage = normalizedReason
    ? `Votre projet a été suspendu par un administrateur. Motif : ${normalizedReason}`
    : "Votre projet a été suspendu par un administrateur. Un administrateur vous contactera si besoin.";

  let createdNotifications = [];
  const updated = await withOptionalTransaction(async (session) => {
    transitionProjectStatus(project, ProjectStatus.SUSPENDED, { action: "ADMIN_DEACTIVATE_PROJECT" });
    project.rejectionReason = normalizedReason || "Suspendu par un administrateur";
    project.rejectedBy = adminId;
    project.rejectedAt = new Date();
    await project.save(session ? { session } : undefined);

    await AuditLog.create(
      [
        {
          actorId: adminId,
          actorRole: "ADMIN",
          action: "DEACTIVATE_PROJECT",
          targetType: "Project",
          targetId: project._id,
          details: { reason: project.rejectionReason },
        },
      ],
      session ? { session } : undefined
    );

    createdNotifications = await Notification.create(
      [
        {
          userId: project.creatorId,
          type: "PROJECT_SUSPENDED",
          title: "Projet suspendu",
          message: suspensionMessage,
          relatedEntityId: project._id,
          relatedEntityType: "PROJECT",
        },
      ],
      session ? { session } : undefined
    );

    return project.toObject();
  });

  // Best-effort (sans bloquer): annuler un payout ouvert lié à ce projet (workflow démo).
  try {
    await payoutService.cancelOpenPayoutForProject({
      adminId,
      projectId: project._id,
      reason: `Projet suspendu${normalizedReason ? ` : ${normalizedReason}` : ""}`,
    });
  } catch {
    // ignorer
  }

  await enqueueEmailForNotifications(createdNotifications);
  return updated;
}

async function reactivateProject({ adminId, projectId }) {
  if (!mongoose.isValidObjectId(projectId)) {
    throw new HttpError(400, "Identifiant de projet invalide.");
  }
  const project = await Project.findById(projectId);
  if (!project) throw new HttpError(404, "Projet introuvable.");

  if (project.isArchived) {
    throw new HttpError(400, "Projet archivé : réactivation impossible.");
  }
  if (project.status !== "SUSPENDED") {
    throw new HttpError(
      409,
      "Réactivation impossible : le projet doit être suspendu (SUSPENDED).",
      { expected: ProjectStatus.SUSPENDED, actual: project.status },
      "INVALID_PROJECT_STATE"
    );
  }
  if (Number(project.currentFunding || 0) >= Number(project.fundingGoal || 0)) {
    throw new HttpError(400, "Réactivation impossible : l’objectif de financement est déjà atteint.");
  }

  const unresolvedOverfunding = await FailedRefundEvent.findOne({
    projectId: project._id,
    reason: "OVERFUNDING",
    resolved: false,
  }).lean();
  if (unresolvedOverfunding) {
    throw new HttpError(400, "Réactivation impossible : remboursements de surfinancement encore en attente.");
  }

  const scheduled = await Investment.findOne({
    projectId: project._id,
    scheduledForDeactivation: true,
  }).lean();
  if (scheduled) {
    throw new HttpError(400, "Réactivation impossible : des investissements sont encore en traitement.");
  }

  const aiFresh = isAiAnalysisFresh(project, { maxAgeDays: 30 });

  let createdNotifications = [];
  const updated = await withOptionalTransaction(async (session) => {
    if (!aiFresh) {
      project.aiAnalysisRetries = 0;
      project.aiStatus = AIStatus.PENDING;
      transitionProjectStatus(project, ProjectStatus.AWAITING_AI, { action: "ADMIN_REACTIVATE_PROJECT_REQUIRES_AI" });
      await project.save(session ? { session } : undefined);
    } else {
      transitionProjectStatus(project, ProjectStatus.UNDER_REVIEW, { action: "ADMIN_REACTIVATE_PROJECT" });
      await project.save(session ? { session } : undefined);
    }

    await AuditLog.create(
      [
        {
          actorId: adminId,
          actorRole: "ADMIN",
          action: "REACTIVATE_PROJECT",
          targetType: "Project",
          targetId: project._id,
          details: { aiFresh },
        },
      ],
      session ? { session } : undefined
    );

    createdNotifications = await Notification.create(
      [
        {
          userId: project.creatorId,
          type: "PROJECT_REACTIVATED",
          title: "Projet réactivé",
          message: aiFresh
            ? "Votre projet a été réactivé et repasse en revue."
            : "Votre projet a été réactivé. Une nouvelle analyse automatique va démarrer avant la revue.",
          relatedEntityId: project._id,
          relatedEntityType: "PROJECT",
        },
      ],
      session ? { session } : undefined
    );

    return project.toObject();
  });

  if (!aiFresh) {
    try {
      await enqueueRiskAnalysisJob(project);
    } catch {
      // best-effort
    }
  }

  await enqueueEmailForNotifications(createdNotifications);
  return updated;
}

module.exports = {
  listAdminProjects,
  validateProject,
  publishProject,
  revokeApproval,
  retryAiAnalysis,
  deactivateProject,
  reactivateProject,
};

