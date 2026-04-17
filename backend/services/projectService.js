const Project = require("../models/Project");
const Investment = require("../models/Investment");
const Transaction = require("../models/Transaction");
const HttpError = require("../utils/HttpError");
const {
  MIN_PROJECT_DEADLINE_DAYS,
  MIN_PROJECT_START_DELAY_DAYS,
} = require("../config/constants");
const { PROJECT_NON_DELETABLE_STATUSES } = require("../config/businessRules");
const { enqueueRiskAnalysisJob } = require("../integrations/riskAnalysisQueue");
const { writeAudit } = require("./auditService");
const notificationService = require("./notificationService");
const { enqueueEmailForNotification } = require("../integrations/emailQueue");
const FailedWorkflowEvent = require("../models/FailedWorkflowEvent");
const {
  ProjectStatus,
  AIStatus,
  isEditableByCreator,
  isArchivableByCreator,
  isPubliclyVisible,
  transitionProjectStatus,
} = require("../config/projectLifecycle");

/** Start of local calendar day at least `MIN_PROJECT_DEADLINE_DAYS` after today. */
function minDateAfterDays(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

async function createDraftProject(creatorId, payload) {
  const startAt = new Date(payload.startAt);
  startAt.setHours(0, 0, 0, 0);

  const deadline = new Date(payload.deadline);
  deadline.setHours(0, 0, 0, 0);

  const minStartAt = minDateAfterDays(MIN_PROJECT_START_DELAY_DAYS);
  if (startAt < minStartAt) {
    throw new HttpError(
      400,
      `Start date must be at least ${MIN_PROJECT_START_DELAY_DAYS} days from today`
    );
  }

  const minDeadlineAt = minDateAfterDays(MIN_PROJECT_DEADLINE_DAYS);
  if (deadline < minDeadlineAt) {
    throw new HttpError(
      400,
      `Deadline must be at least ${MIN_PROJECT_DEADLINE_DAYS} days from today`
    );
  }

  if (deadline <= startAt) {
    throw new HttpError(400, "Deadline must be after the start date");
  }

  const project = await Project.create({
    title: payload.title,
    description: payload.description || "",
    category: payload.category || "",
    fundingGoal: payload.fundingGoal,
    startAt,
    deadline,
    creatorId,
    status: ProjectStatus.DRAFT,
    aiStatus: AIStatus.PENDING,
    currentFunding: 0,
    aiAnalysisRetries: 0,
  });

  try {
    const notif = await notificationService.createInAppNotification({
      userId: creatorId,
      type: "PROJECT_CREATED",
      title: "Projet créé",
      message:
        "Votre projet est enregistré en brouillon. Vous pouvez le modifier puis le soumettre quand vous êtes prêt(e).",
      relatedEntityId: project._id,
      relatedEntityType: "PROJECT",
    });
    await enqueueEmailForNotification(notif._id);
  } catch {
    // notification/email must not break the main flow
  }

  return project;
}

async function getProjectForEdit(creatorId, projectId) {
  const project = await Project.findOne({ _id: projectId, creatorId }).lean();
  if (!project) throw new HttpError(404, "Project not found");

  if (!isEditableByCreator(project.status)) {
    throw new HttpError(403, "Cannot edit project in current status");
  }
  return project;
}

async function updateProject(creatorId, projectId, changes) {
  const project = await Project.findOne({ _id: projectId, creatorId });
  if (!project) throw new HttpError(404, "Project not found");

  if (!isEditableByCreator(project.status)) {
    throw new HttpError(403, "Cannot edit project in current status");
  }

  // Apply changes
  if (changes.title != null) project.title = changes.title;
  if (changes.description != null) project.description = changes.description;
  if (changes.category != null) project.category = changes.category;
  if (changes.fundingGoal != null) project.fundingGoal = changes.fundingGoal;
  if (changes.startAt != null) project.startAt = changes.startAt;
  if (changes.deadline != null) project.deadline = changes.deadline;

  // Re-apply date rules (same as create)
  const startAt = new Date(project.startAt);
  startAt.setHours(0, 0, 0, 0);
  const deadline = new Date(project.deadline);
  deadline.setHours(0, 0, 0, 0);

  const minStartAt = minDateAfterDays(MIN_PROJECT_START_DELAY_DAYS);
  if (startAt < minStartAt) {
    throw new HttpError(
      400,
      `Start date must be at least ${MIN_PROJECT_START_DELAY_DAYS} days from today`
    );
  }
  const minDeadlineAt = minDateAfterDays(MIN_PROJECT_DEADLINE_DAYS);
  if (deadline < minDeadlineAt) {
    throw new HttpError(
      400,
      `Deadline must be at least ${MIN_PROJECT_DEADLINE_DAYS} days from today`
    );
  }
  if (deadline <= startAt) {
    throw new HttpError(400, "Deadline must be after the start date");
  }

  project.startAt = startAt;
  project.deadline = deadline;

  // Conception: if rejected → reset to DRAFT and clear rejection fields
  if (project.status === ProjectStatus.REJECTED) {
    transitionProjectStatus(project, ProjectStatus.DRAFT, { action: "EDIT_REJECTED_PROJECT" });
    project.rejectionReason = "";
    project.rejectedBy = undefined;
    project.rejectedAt = undefined;
  }

  // Conception: if awaiting AI and AI already completed, reset to pending and enqueue again
  if (project.status === ProjectStatus.AWAITING_AI && project.aiStatus === AIStatus.COMPLETED) {
    project.aiStatus = AIStatus.PENDING;
    await enqueueRiskAnalysisJob(project);
  }

  await project.save();

  await writeAudit({
    actorId: creatorId,
    actorRole: "USER",
    action: "EDIT_PROJECT",
    targetType: "Project",
    targetId: project._id,
    details: { fields: Object.keys(changes || {}) },
  });

  try {
    const notif = await notificationService.createInAppNotification({
      userId: creatorId,
      type: "PROJECT_UPDATED",
      title: "Projet mis à jour",
      message: "Vos modifications ont bien été enregistrées.",
      relatedEntityId: project._id,
      relatedEntityType: "PROJECT",
    });
    await enqueueEmailForNotification(notif._id);
  } catch {
    // ignore
  }

  return project;
}

async function listMyProjects(creatorId) {
  return Project.find({ creatorId }).sort({ updatedAt: -1 }).lean();
}

async function getProjectById(projectId, userId) {
  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new HttpError(404, "Project not found");
  }
  const isOwner = userId && String(project.creatorId) === String(userId);
  const isPublic = isPubliclyVisible(project);

  if (!isOwner && !isPublic) {
    throw new HttpError(404, "Project not found");
  }

  return { project, isOwner: Boolean(isOwner) };
}

function buildPublicProjectQuery({ status, category, riskLevel, minFunding, maxFunding, q }) {
  const safeStatus = ["ACTIVE", "CLOSED"].includes(String(status || "").toUpperCase())
    ? String(status).toUpperCase()
    : "ACTIVE";
  const query = {
    status: safeStatus,
    isArchived: false,
    startAt: { $lte: new Date() },
  };

  if (category) {
    query.category = String(category);
  }
  if (riskLevel) {
    query["aiAnalysis.riskLevel"] = String(riskLevel);
  }
  if (minFunding != null || maxFunding != null) {
    query.fundingGoal = {};
    if (minFunding != null) query.fundingGoal.$gte = Number(minFunding);
    if (maxFunding != null) query.fundingGoal.$lte = Number(maxFunding);
  }
  if (q && String(q).trim()) {
    query.$text = { $search: String(q).trim() };
  }
  return query;
}

async function listPublicProjects({ limit = 20 } = {}) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 20;
  return Project.find({
    status: ProjectStatus.ACTIVE,
    isArchived: false,
    startAt: { $lte: new Date() },
  })
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(safeLimit)
    .lean();
}

async function searchPublicProjects(params = {}) {
  const { q, category, riskLevel, status } = params;
  const minFunding = params.minFunding != null ? Number(params.minFunding) : null;
  const maxFunding = params.maxFunding != null ? Number(params.maxFunding) : null;
  const limit = Number(params.limit ?? 20);
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 20;

  const mongoQuery = buildPublicProjectQuery({
    status,
    q,
    category,
    riskLevel,
    minFunding: Number.isFinite(minFunding) ? minFunding : null,
    maxFunding: Number.isFinite(maxFunding) ? maxFunding : null,
  });

  const sort =
    mongoQuery.$text ? { score: { $meta: "textScore" }, createdAt: -1 } : { createdAt: -1 };

  return Project.find(mongoQuery, mongoQuery.$text ? { score: { $meta: "textScore" } } : undefined)
    .sort(sort)
    .limit(safeLimit)
    .lean();
}

/**
 * DRAFT → AWAITING_AI + enqueue risk job (BullMQ/n8n per architecture).
 */
async function submitProjectForAi(creatorId, projectId) {
  const project = await Project.findOne({
    _id: projectId,
    creatorId,
  });
  if (!project) {
    throw new HttpError(404, "Project not found");
  }
  if (project.status !== ProjectStatus.DRAFT) {
    throw new HttpError(
      409,
      "Only DRAFT projects can be submitted for AI review",
      { expected: ProjectStatus.DRAFT, actual: project.status },
      "INVALID_PROJECT_STATE"
    );
  }
  if (project.isArchived) {
    throw new HttpError(400, "Archived projects cannot be submitted");
  }

  const deadline = new Date(project.deadline);
  deadline.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (deadline < today) {
    throw new HttpError(400, "Deadline must be in the future");
  }

  transitionProjectStatus(project, ProjectStatus.AWAITING_AI, { action: "SUBMIT_FOR_AI" });
  project.aiStatus = AIStatus.PENDING;
  project.aiJobId = "";
  project.aiQueuedAt = new Date();
  project.aiLastError = "";
  await project.save();

  try {
    const enq = await enqueueRiskAnalysisJob(project);
    if (enq && enq.queued && enq.jobId) {
      project.aiJobId = String(enq.jobId);
      await project.save();
    }
  } catch (err) {
    // If Redis/BullMQ is down, do not break the user flow.
    // We mark the AI step as failed and record a failed workflow event so admin can retry later.
    project.aiStatus = AIStatus.FAILED;
    project.aiLastError = String(err?.message || err);
    await project.save();
    try {
      await FailedWorkflowEvent.create({
        projectId: project._id,
        workflowType: "risk-analysis",
        payload: { projectId: String(project._id) },
        error: String(err?.message || err),
        retryCount: 0,
        resolved: false,
      });
    } catch {
      // ignore
    }
  }

  try {
    const notif = await notificationService.createInAppNotification({
      userId: creatorId,
      type: "PROJECT_SUBMITTED",
      title: "Projet soumis",
      message:
        "Votre projet a été soumis pour analyse. Vous recevrez une notification quand l’étape suivante commencera.",
      relatedEntityId: project._id,
      relatedEntityType: "PROJECT",
    });
    await enqueueEmailForNotification(notif._id);
  } catch {
    // ignore
  }

  return project;
}

async function archiveProject(creatorId, projectId) {
  const project = await Project.findOne({ _id: projectId, creatorId });
  if (!project) throw new HttpError(404, "Project not found");
  if (project.isArchived) throw new HttpError(400, "Project already archived");

  if (!isArchivableByCreator(project.status)) {
    throw new HttpError(403, "Cannot archive project in current status");
  }

  project.isArchived = true;
  await project.save();

  await writeAudit({
    actorId: creatorId,
    actorRole: "USER",
    action: "ARCHIVE_PROJECT",
    targetType: "Project",
    targetId: project._id,
    details: {},
  });

  try {
    const notif = await notificationService.createInAppNotification({
      userId: creatorId,
      type: "PROJECT_ARCHIVED",
      title: "Projet archivé",
      message:
        "Votre projet est archivé. Il n’apparaît plus dans les listes publiques.",
      relatedEntityId: project._id,
      relatedEntityType: "PROJECT",
    });
    await enqueueEmailForNotification(notif._id);
  } catch {
    // ignore
  }

  return project;
}

async function deleteProject(creatorId, projectId) {
  const project = await Project.findOne({ _id: projectId, creatorId });
  if (!project) throw new HttpError(404, "Project not found");
  const snapshot = { _id: project._id, status: project.status, title: project.title };

  if (PROJECT_NON_DELETABLE_STATUSES.includes(project.status)) {
    throw new HttpError(
      403,
      "Suppression impossible : la campagne est déjà active ou clôturée."
    );
  }

  if (Number(project.currentFunding || 0) > 0) {
    throw new HttpError(
      400,
      "Suppression impossible : un financement a déjà été enregistré sur ce projet."
    );
  }

  const successCount = await Investment.countDocuments({
    projectId: project._id,
    status: "SUCCESS",
  });
  if (successCount > 0) {
    throw new HttpError(
      400,
      "Suppression impossible : des investissements confirmés existent encore."
    );
  }

  // No multi-document transaction: standalone MongoDB (typical local dev) does not
  // support transactions unless configured as a replica set.
  const investments = await Investment.find({ projectId: project._id }).select("_id").lean();
  const invIds = investments.map((i) => i._id);
  if (invIds.length) {
    await Transaction.deleteMany({ investmentId: { $in: invIds } });
    await Investment.deleteMany({ _id: { $in: invIds } });
  }
  await Project.deleteOne({ _id: project._id });

  await writeAudit({
    actorId: creatorId,
    actorRole: "USER",
    action: "DELETE_PROJECT",
    targetType: "Project",
    targetId: projectId,
    details: { previousStatus: project.status, title: project.title },
  });

  try {
    const notif = await notificationService.createInAppNotification({
      userId: creatorId,
      type: "PROJECT_DELETED",
      title: "Projet supprimé",
      message:
        `Le projet “${snapshot.title}” a été supprimé. Cette action est définitive.`,
      relatedEntityId: null,
      relatedEntityType: null,
    });
    await enqueueEmailForNotification(notif._id);
  } catch {
    // ignore
  }

  return { deleted: true };
}

async function resubmitRejectedProject(creatorId, projectId, changes) {
  const project = await Project.findOne({ _id: projectId, creatorId });
  if (!project) throw new HttpError(404, "Project not found");
  if (project.status !== ProjectStatus.REJECTED) {
    throw new HttpError(
      409,
      "Project cannot be resubmitted",
      { expected: ProjectStatus.REJECTED, actual: project.status },
      "INVALID_PROJECT_STATE"
    );
  }
  if (project.isArchived) {
    throw new HttpError(400, "Archived projects cannot be resubmitted");
  }

  // Reuse update logic + then set to AWAITING_AI
  await updateProject(creatorId, projectId, changes);

  const updated = await Project.findOne({ _id: projectId, creatorId });
  transitionProjectStatus(updated, ProjectStatus.AWAITING_AI, { action: "RESUBMIT_REJECTED_PROJECT" });
  updated.aiStatus = AIStatus.PENDING;
  updated.aiAnalysisRetries = 0;
  updated.rejectionReason = "";
  updated.rejectedBy = undefined;
  updated.rejectedAt = undefined;
  await updated.save();

  await writeAudit({
    actorId: creatorId,
    actorRole: "USER",
    action: "RESUBMIT_PROJECT",
    targetType: "Project",
    targetId: updated._id,
    details: { fields: Object.keys(changes || {}) },
  });

  await enqueueRiskAnalysisJob(updated);
  return updated;
}

module.exports = {
  createDraftProject,
  getProjectForEdit,
  updateProject,
  listMyProjects,
  getProjectById,
  listPublicProjects,
  searchPublicProjects,
  submitProjectForAi,
  archiveProject,
  deleteProject,
  resubmitRejectedProject,
};
