const { PROJECT_NON_DELETABLE_STATUSES } = require("./businessRules");

const ProjectStatus = Object.freeze({
  DRAFT: "DRAFT",
  AWAITING_AI: "AWAITING_AI",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  ACTIVE: "ACTIVE",
  REJECTED: "REJECTED",
  FUNDED: "FUNDED",
  CLOSED: "CLOSED",
  SUSPENDED: "SUSPENDED",
});

const AIStatus = Object.freeze({
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
});

const PROJECT_STATUS_TRANSITIONS = Object.freeze({
  // Cycle créateur
  [ProjectStatus.DRAFT]: [ProjectStatus.AWAITING_AI],
  [ProjectStatus.REJECTED]: [ProjectStatus.DRAFT, ProjectStatus.AWAITING_AI],

  // Workflow IA
  // Si l’analyse détecte une incohérence bloquante (règle automatique), on peut rejeter sans revue admin.
  [ProjectStatus.AWAITING_AI]: [ProjectStatus.UNDER_REVIEW, ProjectStatus.REJECTED],

  // Cycle revue admin
  // Le créateur peut modifier pendant la revue → on relance l’IA puis on revient.
  [ProjectStatus.UNDER_REVIEW]: [ProjectStatus.APPROVED, ProjectStatus.REJECTED, ProjectStatus.AWAITING_AI],
  // Si une approbation a été prématurée, les admins peuvent l’annuler et demander des corrections.
  [ProjectStatus.APPROVED]: [ProjectStatus.ACTIVE, ProjectStatus.REJECTED],

  // Cycle financement / clôture
  [ProjectStatus.ACTIVE]: [ProjectStatus.FUNDED, ProjectStatus.CLOSED, ProjectStatus.SUSPENDED],
  [ProjectStatus.FUNDED]: [ProjectStatus.ACTIVE, ProjectStatus.CLOSED, ProjectStatus.SUSPENDED],

  // Cycle modération
  [ProjectStatus.SUSPENDED]: [ProjectStatus.UNDER_REVIEW, ProjectStatus.AWAITING_AI],

  // Terminal (pas de transition sortante via les API)
  [ProjectStatus.CLOSED]: [],
});

function canTransitionProjectStatus(fromStatus, toStatus) {
  const from = String(fromStatus || "");
  const to = String(toStatus || "");
  if (!from || !to) return false;
  if (from === to) return true;
  const allowed = PROJECT_STATUS_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

function assertTransition({ fromStatus, toStatus, action }) {
  if (!canTransitionProjectStatus(fromStatus, toStatus)) {
    // 409 explicite: la ressource existe mais l’état est incompatible avec l’action demandée.
    const HttpError = require("../utils/HttpError");
    throw new HttpError(
      409,
      "Transition de statut invalide pour ce projet.",
      { action: action || null, from: fromStatus, to: toStatus },
      "INVALID_PROJECT_STATE"
    );
  }
}

function transitionProjectStatus(project, toStatus, { action } = {}) {
  assertTransition({ fromStatus: project?.status, toStatus, action });
  project.status = toStatus;
  return project;
}

function isEditableByCreator(status) {
  return [ProjectStatus.DRAFT, ProjectStatus.UNDER_REVIEW, ProjectStatus.REJECTED].includes(
    String(status)
  );
}

function isArchivableByCreator(status) {
  return [
    ProjectStatus.DRAFT,
    ProjectStatus.AWAITING_AI,
    ProjectStatus.UNDER_REVIEW,
    ProjectStatus.REJECTED,
  ].includes(String(status));
}

function isPubliclyVisible(project) {
  return project?.status === ProjectStatus.ACTIVE && !project?.isArchived;
}

function canCreatorDeleteProject(project) {
  if (!project) return false;
  if (PROJECT_NON_DELETABLE_STATUSES.includes(project.status)) return false;
  if (Number(project.currentFunding || 0) > 0) return false;
  return true;
}

function canAdminRetryAi(project) {
  if (!project) return false;
  // Relance « sûre »: uniquement si l’IA est en échec ou périmée et le projet n’est pas en ligne.
  const nonLiveStatuses = [
    ProjectStatus.AWAITING_AI,
    ProjectStatus.UNDER_REVIEW,
    ProjectStatus.APPROVED,
    ProjectStatus.REJECTED,
    ProjectStatus.DRAFT,
    ProjectStatus.SUSPENDED,
  ];
  if (!nonLiveStatuses.includes(project.status)) return false;
  return true;
}

function canSuspendProject(status) {
  // Cohérent avec les états « campagne visible publiquement ».
  return [ProjectStatus.ACTIVE, ProjectStatus.FUNDED].includes(String(status));
}

module.exports = {
  ProjectStatus,
  AIStatus,
  PROJECT_STATUS_TRANSITIONS,
  canTransitionProjectStatus,
  transitionProjectStatus,
  isEditableByCreator,
  isArchivableByCreator,
  isPubliclyVisible,
  canCreatorDeleteProject,
  canAdminRetryAi,
  canSuspendProject,
};

