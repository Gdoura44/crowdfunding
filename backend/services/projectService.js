const Project = require("../models/Project");
const Investment = require("../models/Investment");
const Transaction = require("../models/Transaction");
const HttpError = require("../utils/HttpError");
const {
  MIN_PROJECT_START_DELAY_DAYS,
  MIN_PROJECT_DURATION_DAYS,
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

/** Début du jour calendaire local au moins N jours après aujourd’hui. */
function minDateAfterDays(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function addDaysFrom(date, days) {
  const d = new Date(date);
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
      `Date de démarrage trop proche. Choisissez une date au moins à J+${MIN_PROJECT_START_DELAY_DAYS}.`
    );
  }

  if (deadline <= startAt) {
    throw new HttpError(400, "La date limite doit être postérieure à la date de démarrage.");
  }
  const minDurationDeadline = addDaysFrom(startAt, MIN_PROJECT_DURATION_DAYS);
  minDurationDeadline.setHours(0, 0, 0, 0);
  if (deadline < minDurationDeadline) {
    throw new HttpError(
      400,
      `Durée trop courte. La campagne doit durer au moins ${MIN_PROJECT_DURATION_DAYS} jours (≈ 1 mois) après le démarrage.`
    );
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
      title: `Projet créé — ${project.title}`,
      message:
        `Votre projet “${project.title}” est enregistré en brouillon. Vous pouvez le modifier puis le soumettre quand vous êtes prêt(e).`,
      relatedEntityId: project._id,
      relatedEntityType: "PROJECT",
    });
    await enqueueEmailForNotification(notif);
  } catch {
    // Les notifications/emails ne doivent pas casser le flux principal.
  }

  return project;
}

async function getProjectForEdit(creatorId, projectId) {
  const project = await Project.findOne({ _id: projectId, creatorId }).lean();
  if (!project) throw new HttpError(404, "Projet introuvable.");

  if (!isEditableByCreator(project.status)) {
    throw new HttpError(403, "Modification impossible dans l’état actuel du projet.");
  }
  return project;
}

async function updateProject(creatorId, projectId, changes) {
  const project = await Project.findOne({ _id: projectId, creatorId });
  if (!project) throw new HttpError(404, "Projet introuvable.");

  if (!isEditableByCreator(project.status)) {
    throw new HttpError(403, "Modification impossible dans l’état actuel du projet.");
  }

  // Appliquer les changements
  if (changes.title != null) project.title = changes.title;
  if (changes.description != null) project.description = changes.description;
  if (changes.category != null) project.category = changes.category;
  if (changes.fundingGoal != null) project.fundingGoal = changes.fundingGoal;
  if (changes.startAt != null) project.startAt = changes.startAt;
  if (changes.deadline != null) project.deadline = changes.deadline;

  // Re-appliquer les règles de dates (comme la création)
  // Règles métier dates (PFE):
  // - démarrage >= J+7
  // - durée >= 30 jours à partir de startAt
  const startAt = new Date(project.startAt);
  startAt.setHours(0, 0, 0, 0);
  const deadline = new Date(project.deadline);
  deadline.setHours(0, 0, 0, 0);

  const minStartAt = minDateAfterDays(MIN_PROJECT_START_DELAY_DAYS);
  if (startAt < minStartAt) {
    throw new HttpError(
      400,
      `Date de démarrage trop proche. Choisissez une date au moins à J+${MIN_PROJECT_START_DELAY_DAYS}.`
    );
  }
  if (deadline <= startAt) {
    throw new HttpError(400, "La date limite doit être postérieure à la date de démarrage.");
  }
  const minDurationDeadline = addDaysFrom(startAt, MIN_PROJECT_DURATION_DAYS);
  minDurationDeadline.setHours(0, 0, 0, 0);
  if (deadline < minDurationDeadline) {
    throw new HttpError(
      400,
      `Durée trop courte. La campagne doit durer au moins ${MIN_PROJECT_DURATION_DAYS} jours (≈ 1 mois) après le démarrage.`
    );
  }

  project.startAt = startAt;
  project.deadline = deadline;

  // Conception: si REJECTED → repasser en DRAFT et effacer les champs de rejet.
  if (project.status === ProjectStatus.REJECTED) {
    transitionProjectStatus(project, ProjectStatus.DRAFT, { action: "EDIT_REJECTED_PROJECT" });
    project.rejectionReason = "";
    project.rejectedBy = undefined;
    project.rejectedAt = undefined;
  }

  const editedFields = Object.keys(changes || {});
  const affectsAnalysis = editedFields.some((k) =>
    ["title", "description", "category", "fundingGoal", "startAt", "deadline"].includes(String(k))
  );

  // Si le créateur modifie son projet pendant la revue admin, on relance l’analyse IA et on
  // ramène le projet à l’état AWAITING_AI pour éviter une décision admin sur des données obsolètes.
  if (project.status === ProjectStatus.UNDER_REVIEW && affectsAnalysis) {
    // Intention: dès que le créateur modifie un champ impactant, l’ancienne analyse n’est plus fiable.
    // On relance donc automatiquement l’analyse IA (best-effort, sans bloquer l’utilisateur).
    transitionProjectStatus(project, ProjectStatus.AWAITING_AI, { action: "EDIT_PROJECT_RERUN_AI" });
    project.aiStatus = AIStatus.PENDING;
    project.aiAnalysisRetries = 0;
    project.aiLastError = "";
    project.aiAnalysis = undefined;
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
      title: `Projet mis à jour — ${project.title}`,
      message: `Vos modifications sur “${project.title}” ont bien été enregistrées.`,
      relatedEntityId: project._id,
      relatedEntityType: "PROJECT",
    });
    await enqueueEmailForNotification(notif);
  } catch {
    // ignorer
  }

  return project;
}

async function listMyProjects(creatorId) {
  return Project.find({ creatorId }).sort({ updatedAt: -1 }).lean();
}

async function getProjectById(projectId, userId) {
  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new HttpError(404, "Projet introuvable.");
  }
  const isOwner = userId && String(project.creatorId) === String(userId);
  const isPublic = isPubliclyVisible(project);

  if (!isOwner && !isPublic) {
    throw new HttpError(404, "Projet introuvable.");
  }

  return { project, isOwner: Boolean(isOwner) };
}

function buildPublicProjectQuery({ status, category, riskLevel, minFunding, maxFunding, q, includeUpcoming }) {
  const safeStatus = ["ACTIVE", "CLOSED"].includes(String(status || "").toUpperCase())
    ? String(status).toUpperCase()
    : "ACTIVE";
  const query = {
    status: safeStatus,
    isArchived: false,
  };
  if (!includeUpcoming) {
    query.startAt = { $lte: new Date() };
  }

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
  const includeUpcoming =
    String(params.includeUpcoming || "").trim().toLowerCase() === "true";

  const mongoQuery = buildPublicProjectQuery({
    status,
    q,
    category,
    riskLevel,
    minFunding: Number.isFinite(minFunding) ? minFunding : null,
    maxFunding: Number.isFinite(maxFunding) ? maxFunding : null,
    includeUpcoming,
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
    throw new HttpError(404, "Projet introuvable.");
  }
  if (project.status !== ProjectStatus.DRAFT) {
    throw new HttpError(
      409,
      "Soumission impossible : seul un projet en brouillon (DRAFT) peut être soumis.",
      { expected: ProjectStatus.DRAFT, actual: project.status },
      "INVALID_PROJECT_STATE"
    );
  }
  if (project.isArchived) {
    throw new HttpError(400, "Soumission impossible : le projet est archivé.");
  }

  const deadline = new Date(project.deadline);
  deadline.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (deadline < today) {
    throw new HttpError(400, "La date limite doit être dans le futur.");
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
    // Si Redis/BullMQ est indisponible, ne pas casser le parcours utilisateur.
    // On marque l’étape IA en échec et on enregistre un FailedWorkflowEvent pour relance admin.
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
      // ignorer
    }
  }

  try {
    const notif = await notificationService.createInAppNotification({
      userId: creatorId,
      type: "PROJECT_SUBMITTED",
      title: `Projet soumis — ${project.title}`,
      message:
        `Votre projet “${project.title}” a été soumis pour analyse. Vous recevrez une notification quand l’étape suivante commencera.`,
      relatedEntityId: project._id,
      relatedEntityType: "PROJECT",
    });
    await enqueueEmailForNotification(notif._id);
  } catch {
    // ignorer
  }

  return project;
}

async function archiveProject(creatorId, projectId) {
  const project = await Project.findOne({ _id: projectId, creatorId });
  if (!project) throw new HttpError(404, "Projet introuvable.");
  if (project.isArchived) throw new HttpError(400, "Projet déjà archivé.");

  if (!isArchivableByCreator(project.status)) {
    throw new HttpError(403, "Archivage impossible dans l’état actuel du projet.");
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
      title: `Projet archivé — ${project.title}`,
      message:
        `Votre projet “${project.title}” est archivé. Il n’apparaît plus dans les listes publiques.`,
      relatedEntityId: project._id,
      relatedEntityType: "PROJECT",
    });
    await enqueueEmailForNotification(notif._id);
  } catch {
    // ignorer
  }

  return project;
}

async function deleteProject(creatorId, projectId) {
  const project = await Project.findOne({ _id: projectId, creatorId });
  if (!project) throw new HttpError(404, "Projet introuvable.");
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

  // Pas de transaction multi-doc: MongoDB standalone (dev local) ne supporte pas les transactions
  // sauf configuration en replica set.
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
    // ignorer
  }

  return { deleted: true };
}

async function resubmitRejectedProject(creatorId, projectId, changes) {
  const project = await Project.findOne({ _id: projectId, creatorId });
  if (!project) throw new HttpError(404, "Projet introuvable.");
  if (project.status !== ProjectStatus.REJECTED) {
    throw new HttpError(
      409,
      "Renvoi impossible : le projet n’est pas en état REJECTED.",
      { expected: ProjectStatus.REJECTED, actual: project.status },
      "INVALID_PROJECT_STATE"
    );
  }
  if (project.isArchived) {
    throw new HttpError(400, "Renvoi impossible : le projet est archivé.");
  }

  // Réutiliser la logique d’update puis repasser en AWAITING_AI
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
