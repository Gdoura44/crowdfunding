const express = require("express");
const mongoose = require("mongoose");
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
const Comment = require("../../models/Comment");
// (User est déjà importé plus haut dans ce module via d’autres services.)

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
      message: "Utilisateur réactivé.",
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
      unreadOnly: req.query.unreadOnly,
    });
    res.json({ notifications });
  })
);

router.put(
  "/notifications/:id/read",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const notification = await notificationService.markAdminRead(req.params.id);
    res.json({ notification, message: "Marquée comme lue." });
  })
);

router.patch(
  "/notifications/:id/read",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const notification = await notificationService.markAdminRead(req.params.id);
    res.json({ notification, message: "Marquée comme lue." });
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
    if (!resolution) throw new HttpError(400, "Le champ « resolution » est requis.");
    const report = await reportService.resolveReport({
      adminId: req.user.id,
      reportId: req.params.id,
      resolution,
      actionOnProject,
      actionOnComment: req.body?.actionOnComment,
      status,
    });
    res.json({
      report,
      message:
        String(status || "RESOLVED").toUpperCase() === "DISMISSED"
          ? "Signalement classé sans suite."
          : "Signalement traité.",
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

router.get(
  "/comments",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const n = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 50;
    const projectId = String(req.query.projectId || "").trim();
    const includeHidden = String(req.query.includeHidden || "").trim().toLowerCase() === "true";
    const q = String(req.query.q || "").trim();

    const query = {};
    if (projectId && mongoose.isValidObjectId(projectId)) query.projectId = projectId;
    if (!includeHidden) query.isHidden = false;
    if (q) query.content = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

    const comments = await Comment.find(query)
      .select({
        projectId: 1,
        userId: 1,
        authorLabel: 1,
        content: 1,
        isHidden: 1,
        hiddenReason: 1,
        createdAt: 1,
      })
      .populate({ path: "projectId", select: { title: 1 }, options: { lean: true } })
      .populate({ path: "userId", select: { email: 1, profile: 1 }, options: { lean: true } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ comments });
  })
);

router.patch(
  "/comments/:id/hide",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Identifiant de commentaire invalide.");
    }
    const reason = String(req.body?.reason || "").trim();
    const comment = await Comment.findById(req.params.id);
    if (!comment) throw new HttpError(404, "Commentaire introuvable.");
    comment.isHidden = true;
    comment.hiddenReason = reason;
    comment.hiddenAt = new Date();
    comment.hiddenBy = req.user.id;
    await comment.save();
    res.json({ comment: comment.toObject(), message: "Commentaire masqué." });
  })
);

router.patch(
  "/comments/:id/unhide",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Identifiant de commentaire invalide.");
    }
    const comment = await Comment.findById(req.params.id);
    if (!comment) throw new HttpError(404, "Commentaire introuvable.");
    comment.isHidden = false;
    comment.hiddenReason = "";
    comment.hiddenAt = undefined;
    comment.hiddenBy = undefined;
    await comment.save();
    res.json({ comment: comment.toObject(), message: "Commentaire rétabli." });
  })
);

router.post(
  "/projects/:id/validate",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { decision, feedback } = req.body || {};
    if (!decision) throw new HttpError(400, "Le champ « decision » est requis (APPROVED ou REJECTED).");

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
          ? "Projet approuvé."
          : "Projet rejeté.",
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
    res.json({ project, message: "Projet publié (en ligne)." });
  })
);

router.post(
  "/projects/:id/revoke-approval",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const project = await adminProjectService.revokeApproval({
      adminId: req.user.id,
      projectId: req.params.id,
      reason: req.body?.reason,
    });
    res.json({ project, message: "Approbation annulée. Corrections demandées au créateur." });
  })
);

router.post(
  "/projects/:id/retry-ai",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const out = await adminProjectService.retryAiAnalysis({
      adminId: req.user.id,
      projectId: req.params.id,
    });
    res.json({
      project: out?.project || out,
      diagnostics: out?.diagnostics,
      message: "Relance de l’analyse IA demandée.",
    });
  })
);

router.post(
  "/projects/:id/deactivate",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const project = await adminProjectService.deactivateProject({
      adminId: req.user.id,
      projectId: req.params.id,
      reason: req.body?.reason,
    });
    res.json({ project, message: "Projet suspendu." });
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
    res.json({ project, message: "Projet réactivé." });
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
    const out = await payoutService.approvePayout({
      adminId: req.user.id,
      payoutId: req.params.id,
      notes: req.body?.notes,
    });
    res.json({
      payout: out?.payout || out,
      transferUrl: out?.transferUrl,
      message: "Virement initié (simulation).",
    });
  })
);

router.post(
  "/payouts/:id/mock-confirm",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payout = await payoutService.confirmMockPayoutTransfer({
      adminId: req.user.id,
      payoutId: req.params.id,
      providerTransferId: req.body?.providerTransferId,
      status: req.body?.status,
    });
    res.json({ payout, message: "Statut de virement mis à jour (simulation)." });
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
    if (!eventId) throw new HttpError(400, "Le champ « eventId » est requis.");
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

