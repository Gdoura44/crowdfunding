const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const investmentService = require("../../services/investmentService");

const router = express.Router();

/**
 * Webhooks entrants (callbacks prestataire de paiement).
 * — Aujourd’hui : mock (`/mock-payments`) pour tests / alignement avec un flux type PCI.
 * — Plus tard : ajouter ici les routes dédiées (ex. Flouci, autre PSP) avec vérification de signature,
 *   puis délégation vers le même service métier que le mock.
 */
router.post(
  "/mock-payments",
  asyncHandler(async (req, res) => {
    const result = await investmentService.handleMockWebhook(req);
    res.json(result);
  })
);

module.exports = router;

