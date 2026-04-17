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
const { ProjectStatus, AIStatus, canAdminRetryAi, transitionProjectStatus } = require("../config/projectLifecycle");

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
    throw new HttpError(400, "Invalid project id");
  }
  const normalizedDecision = String(decision || "").toUpperCase();
  if (!["APPROVED", "REJECTED"].includes(normalizedDecision)) {
    throw new HttpError(400, "Decision must be APPROVED or REJECTED");
  }

  const project = await Project.findById(projectId);
  if (!project) throw new HttpError(404, "Project not found");

  if (project.status !== "UNDER_REVIEW") {
    throw new HttpError(
      409,
      "Project not in review state",
      { expected: ProjectStatus.UNDER_REVIEW, actual: project.status },
      "INVALID_PROJECT_STATE"
    );
  }
  if (project.aiStatus !== AIStatus.COMPLETED || !project.aiAnalysis) {
    throw new HttpError(400, "AI analysis not complete or project not ready");
  }
  if (!isAiAnalysisFresh(project, { maxAgeDays: 30 })) {
    throw new HttpError(400, "AI analysis outdated, please retry");
  }
  if (project.deadline && new Date(project.deadline) < new Date()) {
    throw new HttpError(400, "Project deadline passed");
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
            title: "Votre projet est approuvé",
            message:
              "Bonne nouvelle : votre projet a été approuvé. Un administrateur peut maintenant le publier pour l’ouvrir aux investissements.",
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
            title: "Votre projet a besoin de corrections",
            message:
              "Votre projet n’a pas été validé pour le moment. Vous pouvez le modifier puis le renvoyer pour révision." +
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
    throw new HttpError(400, "Invalid project id");
  }
  const project = await Project.findById(projectId);
  if (!project) throw new HttpError(404, "Project not found");
  if (project.status !== "APPROVED") {
    throw new HttpError(
      409,
      "Project not in approved state",
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
          title: "Votre projet est en ligne",
          message:
            "Votre projet est maintenant visible publiquement et ouvert aux investissements.",
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
    throw new HttpError(400, "Invalid project id");
  }
  const project = await Project.findById(projectId);
  if (!project) throw new HttpError(404, "Project not found");

  if (project.aiAnalysisRetries >= 3) {
    throw new HttpError(400, "AI retry limit reached");
  }

  if (!canAdminRetryAi(project)) {
    throw new HttpError(
      409,
      "Project is not eligible for AI retry in its current state",
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
    // enqueue is best-effort (stub if REDIS_URL missing)
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

async function reactivateProject({ adminId, projectId }) {
  if (!mongoose.isValidObjectId(projectId)) {
    throw new HttpError(400, "Invalid project id");
  }
  const project = await Project.findById(projectId);
  if (!project) throw new HttpError(404, "Project not found");

  if (project.isArchived) {
    throw new HttpError(400, "Archived projects cannot be reactivated");
  }
  if (project.status !== "SUSPENDED") {
    throw new HttpError(
      409,
      "Project must be SUSPENDED to reactivate",
      { expected: ProjectStatus.SUSPENDED, actual: project.status },
      "INVALID_PROJECT_STATE"
    );
  }
  if (Number(project.currentFunding || 0) >= Number(project.fundingGoal || 0)) {
    throw new HttpError(400, "Project already reached its funding goal");
  }

  const unresolvedOverfunding = await FailedRefundEvent.findOne({
    projectId: project._id,
    reason: "OVERFUNDING",
    resolved: false,
  }).lean();
  if (unresolvedOverfunding) {
    throw new HttpError(400, "Project has unresolved overfunding refunds");
  }

  const scheduled = await Investment.findOne({
    projectId: project._id,
    scheduledForDeactivation: true,
  }).lean();
  if (scheduled) {
    throw new HttpError(400, "Project has investments scheduled for deactivation");
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
  retryAiAnalysis,
  reactivateProject,
};

