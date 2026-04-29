const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const investmentService = require("../../services/investmentService");

const router = express.Router();

// Webhook de paiement simulé (mock) : signature similaire à un vrai prestataire.
router.post(
  "/mock-payments",
  asyncHandler(async (req, res) => {
    const result = await investmentService.handleMockWebhook(req);
    res.json(result);
  })
);

module.exports = router;

