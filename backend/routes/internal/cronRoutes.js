const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const cronService = require("../../services/cronService");
const investmentCronService = require("../../services/investmentCronService");
const sessionCronService = require("../../services/sessionCronService");

const router = express.Router();

// Endpoints de type cron (comportement proche production), protégés par un bearer interne.
// Protection via `requireInternalBearer` dans `routes/internal/index.js`.

router.get(
  "/expire-projects",
  asyncHandler(async (req, res) => {
    const summary = await cronService.expireProjects({
      limit: req.query.limit,
    });
    res.json({ ok: true, summary });
  })
);

router.get(
  "/close-funded-projects",
  asyncHandler(async (req, res) => {
    const summary = await cronService.closeFundedProjects({
      limit: req.query.limit,
    });
    res.json({ ok: true, summary });
  })
);

router.get(
  "/retry-failed-refunds",
  asyncHandler(async (req, res) => {
    const summary = await cronService.retryFailedRefunds({ limit: req.query.limit });
    res.json({ ok: true, summary });
  })
);

router.get(
  "/retry-failed-payouts",
  asyncHandler(async (req, res) => {
    const summary = await cronService.retryFailedPayouts({ limit: req.query.limit });
    res.json({ ok: true, summary });
  })
);

router.get(
  "/expire-investments",
  asyncHandler(async (req, res) => {
    const summary = await investmentCronService.expireInitiatedInvestments({
      olderThanMinutes: req.query.olderThanMinutes,
      limit: req.query.limit,
    });
    res.json({ ok: true, summary });
  })
);

router.get(
  "/cleanup-stuck-states",
  asyncHandler(async (req, res) => {
    const summary = await cronService.cleanupStuckStates({
      limit: req.query.limit,
    });
    res.json({ ok: true, summary });
  })
);

router.get(
  "/retry-stuck-ai",
  asyncHandler(async (req, res) => {
    const summary = await cronService.retryStuckAiAnalyses({
      olderThanMinutes: req.query.olderThanMinutes,
      limit: req.query.limit,
    });
    res.json({ ok: true, summary });
  })
);

router.get(
  "/cleanup-refresh-tokens",
  asyncHandler(async (req, res) => {
    const summary = await sessionCronService.cleanupExpiredRefreshTokens({
      limit: req.query.limit,
    });
    res.json({ ok: true, summary });
  })
);

module.exports = router;

