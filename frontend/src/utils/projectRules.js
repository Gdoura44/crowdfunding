/** Matches backend `DELETABLE_PROJECT_STATUSES` + funding rule. */
export const PRE_ACTIVE_DELETE_STATUSES = [
  "DRAFT",
  "AWAITING_AI",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
];

export function canCreatorDeleteProject(project) {
  if (!project) return false;
  if (!PRE_ACTIVE_DELETE_STATUSES.includes(project.status)) return false;
  if (Number(project.currentFunding || 0) > 0) return false;
  return true;
}
