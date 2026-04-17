const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const HttpError = require("../../utils/HttpError");
const { requireAuth } = require("../../middleware/auth");
const reportService = require("../../services/reportService");

const router = express.Router();

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { projectId, type, description } = req.body || {};
    if (!projectId) throw new HttpError(400, "projectId is required");
    if (!type) throw new HttpError(400, "type is required");

    const report = await reportService.createReport({
      reporterId: req.user.id,
      projectId,
      type,
      description,
    });
    res.status(201).json({ report, message: "Report submitted" });
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

