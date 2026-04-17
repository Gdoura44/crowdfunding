const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { requireAuth } = require("../../middleware/auth");
const HttpError = require("../../utils/HttpError");
const payoutService = require("../../services/payoutService");
const { requireNotAdmin } = require("../../middleware/requireNotAdmin");

const router = express.Router();

router.get(
  "/mine",
  requireAuth,
  requireNotAdmin,
  asyncHandler(async (req, res) => {
    const payouts = await payoutService.listMyPayouts(req.user.id, { limit: req.query.limit });
    res.json({ payouts });
  })
);

router.get(
  "/:id",
  requireAuth,
  requireNotAdmin,
  asyncHandler(async (req, res) => {
    const payout = await payoutService.getMyPayout(req.user.id, req.params.id);
    res.json({ payout });
  })
);

router.put(
  "/:id/bank-details",
  requireAuth,
  requireNotAdmin,
  asyncHandler(async (req, res) => {
    const { bankDetails } = req.body || {};
    if (!bankDetails) throw new HttpError(400, "bankDetails is required");
    const payout = await payoutService.provideBankDetails(req.user.id, req.params.id, bankDetails);
    res.json({ payout, message: "Bank details saved" });
  })
);

module.exports = router;

