const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { requireAuth } = require("../../middleware/auth");
const { requireAdmin } = require("../../middleware/requireAdmin");
const HttpError = require("../../utils/HttpError");
const adminProjectService = require("../../services/adminProjectService");
const adminUserService = require("../../services/adminUserService");
const notificationService = require("../../services/notificationService");
const reportService = require("../../services/reportService");
const payoutService = require("../../services/payoutService");
const adminOpsService = require("../../services/adminOpsService");

const router = express.Router();

router.get(
  "/users",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const users = await adminUserService.listUsers({ limit: req.query.limit });
    res.json({ users });
  })
);

router.patch(
  "/users/:id/active",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const isActive = Boolean(req.body?.isActive);
    const user = await adminUserService.setUserActive({
      userId: req.params.id,
      isActive,
    });
    res.json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  })
);

router.post(
  "/users/:id/reactivate",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = await adminUserService.reactivateUser({
      adminId: req.user.id,
      userId: req.params.id,
    });
    res.json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      message: "User reactivated",
    });
  })
);

router.get(
  "/notifications",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const notifications = await notificationService.listAllNotificationsForAdmin({
      limit: req.query.limit,
    });
    res.json({ notifications });
  })
);

router.get(
  "/reports",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const reports = await reportService.listAdminReports({
      status: req.query.status,
      limit: req.query.limit,
    });
    res.json({ reports });
  })
);

router.post(
  "/reports/:id/resolve",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { resolution, actionOnProject, status } = req.body || {};
    if (!resolution) throw new HttpError(400, "resolution is required");
    const report = await reportService.resolveReport({
      adminId: req.user.id,
      reportId: req.params.id,
      resolution,
      actionOnProject,
      status,
    });
    res.json({
      report,
      message: String(status || "RESOLVED").toUpperCase() === "DISMISSED" ? "Report dismissed" : "Report resolved",
    });
  })
);

router.get(
  "/projects",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const projects = await adminProjectService.listAdminProjects({
      status: req.query.status,
      limit: req.query.limit,
    });
    res.json({ projects });
  })
);

router.post(
  "/projects/:id/validate",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { decision, feedback } = req.body || {};
    if (!decision) throw new HttpError(400, "decision is required");

    const project = await adminProjectService.validateProject({
      adminId: req.user.id,
      projectId: req.params.id,
      decision,
      feedback,
    });

    res.json({
      project,
      message:
        String(decision).toUpperCase() === "APPROVED"
          ? "Project approved"
          : "Project rejected",
    });
  })
);

router.post(
  "/projects/:id/publish",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const project = await adminProjectService.publishProject({
      adminId: req.user.id,
      projectId: req.params.id,
    });
    res.json({ project, message: "Project published" });
  })
);

router.post(
  "/projects/:id/retry-ai",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const project = await adminProjectService.retryAiAnalysis({
      adminId: req.user.id,
      projectId: req.params.id,
    });
    res.json({ project, message: "AI analysis retry requested" });
  })
);

router.post(
  "/projects/:id/reactivate",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const project = await adminProjectService.reactivateProject({
      adminId: req.user.id,
      projectId: req.params.id,
    });
    res.json({ project, message: "Project reactivated" });
  })
);

router.get(
  "/payouts",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payouts = await payoutService.listAdminPayouts({
      status: req.query.status,
      limit: req.query.limit,
    });
    res.json({ payouts });
  })
);

router.post(
  "/payouts/:id/approve",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payout = await payoutService.approvePayout({
      adminId: req.user.id,
      payoutId: req.params.id,
      notes: req.body?.notes,
    });
    res.json({ payout, message: "Payout approved" });
  })
);

router.get(
  "/ops/failed-refunds",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const items = await adminOpsService.listFailedRefunds({
      resolved: req.query.resolved,
      limit: req.query.limit,
    });
    res.json({ failedRefunds: items });
  })
);

router.get(
  "/failed-notifications",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const items = await adminOpsService.listFailedNotifications({
      resolved: req.query.resolved,
      limit: req.query.limit,
    });
    res.json({ failedNotifications: items });
  })
);

router.post(
  "/retry-notification",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const eventId = req.body?.eventId;
    if (!eventId) throw new HttpError(400, "eventId is required");
    const out = await adminOpsService.retryNotificationOnce({
      adminId: req.user.id,
      eventId,
    });
    res.json({ ok: true, ...out });
  })
);

router.get(
  "/ops/failed-payouts",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const items = await adminOpsService.listFailedPayouts({
      resolved: req.query.resolved,
      limit: req.query.limit,
    });
    res.json({ failedPayouts: items });
  })
);

router.post(
  "/ops/retry-refunds",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const summary = await adminOpsService.retryRefundsOnce({ limit: req.body?.limit });
    res.json({ ok: true, summary });
  })
);

router.post(
  "/ops/retry-payouts",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const summary = await adminOpsService.retryPayoutsOnce({ limit: req.body?.limit });
    res.json({ ok: true, summary });
  })
);

module.exports = router;

