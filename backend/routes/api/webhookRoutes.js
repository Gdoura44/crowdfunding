const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const investmentService = require("../../services/investmentService");

const router = express.Router();

// Mock payment provider webhook (simulate signature like a real gateway).
router.post(
  "/mock-payments",
  asyncHandler(async (req, res) => {
    const result = await investmentService.handleMockWebhook(req);
    res.json(result);
  })
);

module.exports = router;

