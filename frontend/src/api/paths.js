/**
 * Single source of truth for REST paths (matches backend `routes/api/*`).
 * When you add routes on the server, add the path here and use it via `authApi` / `projectsApi`.
 */

export const paths = {
  health: "/api/health",
  auth: {
    register: "/api/auth/register",
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    refresh: "/api/auth/refresh",
    me: "/api/auth/me",
    verifyEmail: "/api/auth/verify-email",
    resendVerification: "/api/auth/resend-verification",
    forgotPassword: "/api/auth/forgot-password",
    resetPassword: "/api/auth/reset-password",
  },
  projects: {
    collection: "/api/projects",
    mine: "/api/projects/mine",
    public: "/api/projects/public",
    search: "/api/projects/search",
    byId: (id) => `/api/projects/${id}`,
    edit: (id) => `/api/projects/${id}/edit`,
    update: (id) => `/api/projects/${id}`,
    resubmit: (id) => `/api/projects/${id}/resubmit`,
    archive: (id) => `/api/projects/${id}/archive`,
    submitForAi: (id) => `/api/projects/${id}/submit-for-ai`,
    delete: (id) => `/api/projects/${id}`,
  },
  notifications: {
    list: "/api/notifications",
    markRead: (id) => `/api/notifications/${id}/read`,
  },
  users: {
    profile: "/api/users/profile",
    deleteAccount: "/api/users/delete-account",
  },
  admin: {
    projects: "/api/admin/projects",
    users: "/api/admin/users",
    notifications: "/api/admin/notifications",
    setUserActive: (id) => `/api/admin/users/${id}/active`,
    reactivateUser: (id) => `/api/admin/users/${id}/reactivate`,
    reports: "/api/admin/reports",
    resolveReport: (id) => `/api/admin/reports/${id}/resolve`,
    validateProject: (id) => `/api/admin/projects/${id}/validate`,
    publishProject: (id) => `/api/admin/projects/${id}/publish`,
    retryAi: (id) => `/api/admin/projects/${id}/retry-ai`,
    reactivateProject: (id) => `/api/admin/projects/${id}/reactivate`,
    payouts: "/api/admin/payouts",
    approvePayout: (id) => `/api/admin/payouts/${id}/approve`,
    failedNotifications: "/api/admin/failed-notifications",
    retryNotification: "/api/admin/retry-notification",
    opsFailedRefunds: "/api/admin/ops/failed-refunds",
    opsFailedPayouts: "/api/admin/ops/failed-payouts",
    opsRetryRefunds: "/api/admin/ops/retry-refunds",
    opsRetryPayouts: "/api/admin/ops/retry-payouts",
  },
  investments: {
    create: "/api/investments",
    mine: "/api/investments/mine",
    cancel: (id) => `/api/investments/${id}/cancel`,
    retry: (id) => `/api/investments/${id}/retry`,
    mockConfirm: "/api/investments/mock/confirm",
  },
  reports: {
    create: "/api/reports",
    mine: "/api/reports/mine",
  },
  payouts: {
    mine: "/api/payouts/mine",
    byId: (id) => `/api/payouts/${id}`,
    bankDetails: (id) => `/api/payouts/${id}/bank-details`,
  },
  recommendations: {
    list: "/api/recommendations",
  },
  chatbot: {
    askProject: (id) => `/api/projects/${id}/chat`,
  },
};
