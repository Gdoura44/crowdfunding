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
  // Creator lifecycle
  [ProjectStatus.DRAFT]: [ProjectStatus.AWAITING_AI],
  [ProjectStatus.REJECTED]: [ProjectStatus.DRAFT, ProjectStatus.AWAITING_AI],

  // AI workflow
  [ProjectStatus.AWAITING_AI]: [ProjectStatus.UNDER_REVIEW],

  // Admin review lifecycle
  [ProjectStatus.UNDER_REVIEW]: [ProjectStatus.APPROVED, ProjectStatus.REJECTED],
  [ProjectStatus.APPROVED]: [ProjectStatus.ACTIVE],

  // Funding / closure lifecycle
  [ProjectStatus.ACTIVE]: [ProjectStatus.FUNDED, ProjectStatus.CLOSED, ProjectStatus.SUSPENDED],
  [ProjectStatus.FUNDED]: [ProjectStatus.ACTIVE, ProjectStatus.CLOSED, ProjectStatus.SUSPENDED],

  // Moderation lifecycle
  [ProjectStatus.SUSPENDED]: [ProjectStatus.UNDER_REVIEW, ProjectStatus.AWAITING_AI],

  // Terminal (no forward transitions expected via APIs)
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
    // 409 makes it explicit: the resource exists, but state conflicts with the requested action.
    const HttpError = require("../utils/HttpError");
    throw new HttpError(
      409,
      "Invalid project state transition",
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
  return [ProjectStatus.DRAFT, ProjectStatus.AWAITING_AI, ProjectStatus.REJECTED].includes(
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
  // “Safe” retry: only when AI is failed or outdated and the project is not live.
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
  // Keep it simple and consistent with “public-facing campaign” states.
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

