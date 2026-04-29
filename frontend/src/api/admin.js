import http from "./client";
import { paths } from "./paths";

export const adminApi = {
  listProjects: (params) => http.get(paths.admin.projects, { params }),
  listUsers: (params) => http.get(paths.admin.users, { params }),
  listNotifications: (params) => http.get(paths.admin.notifications, { params }),
  markAdminNotificationRead: (id) => http.put(paths.admin.markAdminNotificationRead(id)),
  listReports: (params) => http.get(paths.admin.reports, { params }),
  resolveReport: (id, body) => http.post(paths.admin.resolveReport(id), body),
  setUserActive: (id, body) => http.patch(paths.admin.setUserActive(id), body),
  reactivateUser: (id) => http.post(paths.admin.reactivateUser(id)),
  validateProject: (id, body) => http.post(paths.admin.validateProject(id), body),
  publishProject: (id) => http.post(paths.admin.publishProject(id)),
  revokeApproval: (id, body) => http.post(paths.admin.revokeApproval(id), body),
  retryAiAnalysis: (id) => http.post(paths.admin.retryAi(id)),
  deactivateProject: (id, body) => http.post(paths.admin.deactivateProject(id), body),
  reactivateProject: (id) => http.post(paths.admin.reactivateProject(id)),
  listComments: (params) => http.get(paths.admin.comments, { params }),
  hideComment: (id, body) => http.patch(paths.admin.hideComment(id), body),
  unhideComment: (id) => http.patch(paths.admin.unhideComment(id)),
  listPayouts: (params) => http.get(paths.admin.payouts, { params }),
  approvePayout: (id, body) => http.post(paths.admin.approvePayout(id), body),
  listFailedNotifications: (params) => http.get(paths.admin.failedNotifications, { params }),
  retryNotification: (eventId) => http.post(paths.admin.retryNotification, { eventId }),

  opsListFailedRefunds: (params) => http.get(paths.admin.opsFailedRefunds, { params }),
  opsListFailedPayouts: (params) => http.get(paths.admin.opsFailedPayouts, { params }),
  opsRetryRefunds: (body) => http.post(paths.admin.opsRetryRefunds, body),
  opsRetryPayouts: (body) => http.post(paths.admin.opsRetryPayouts, body),
};

