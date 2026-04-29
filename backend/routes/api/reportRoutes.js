const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const HttpError = require("../../utils/HttpError");
const { requireAuth } = require("../../middleware/auth");
const reportService = require("../../services/reportService");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

const router = express.Router();

const createReportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?.id ? `u:${String(req.user.id)}` : ipKeyGenerator(req)),
  message: { message: "Trop de signalements en peu de temps. Merci de réessayer plus tard." },
});

router.post(
  "/",
  requireAuth,
  createReportLimiter,
  asyncHandler(async (req, res) => {
    const { projectId, type, description } = req.body || {};
    if (!projectId) throw new HttpError(400, "projectId est requis.");
    if (!type) throw new HttpError(400, "type est requis.");

    const report = await reportService.createReport({
      reporterId: req.user.id,
      projectId,
      type,
      description,
    });
    res.status(201).json({
      report,
      message:
        "Signalement envoyé. Merci, un administrateur va examiner votre demande.",
    });
  })
);

router.post(
  "/comments",
  requireAuth,
  createReportLimiter,
  asyncHandler(async (req, res) => {
    const { projectId, commentId, type, description } = req.body || {};
    if (!projectId) throw new HttpError(400, "projectId est requis.");
    if (!commentId) throw new HttpError(400, "commentId est requis.");
    if (!type) throw new HttpError(400, "type est requis.");

    const report = await reportService.createCommentReport({
      reporterId: req.user.id,
      projectId,
      commentId,
      type,
      description,
    });
    res.status(201).json({
      report,
      message: "Signalement envoyé. Merci, un administrateur va examiner votre demande.",
    });
  })
);

router.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const reports = await reportService.listMyReports(req.user.id, { limit: req.query.limit });
    res.json({ reports });
  })
);

module.exports = router;

