const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { requireAuth } = require("../../middleware/auth");
const HttpError = require("../../utils/HttpError");
const investmentService = require("../../services/investmentService");
const { requireNotAdmin } = require("../../middleware/requireNotAdmin");

const router = express.Router();

router.post(
  "/",
  requireAuth,
  requireNotAdmin,
  asyncHandler(async (req, res) => {
    const { projectId, amount } = req.body || {};
    if (!projectId) throw new HttpError(400, "projectId est requis.");
    if (amount == null) throw new HttpError(400, "amount est requis.");
    if (Number(amount) <= 0) throw new HttpError(400, "Le montant doit être supérieur à 0.");

    const result = await investmentService.createInvestment({
      investorId: req.user.id,
      projectId,
      amount,
    });

    res.status(201).json(result);
  })
);

router.get(
  "/mine",
  requireAuth,
  requireNotAdmin,
  asyncHandler(async (req, res) => {
    const investments = await investmentService.listMyInvestments(req.user.id, {
      limit: req.query.limit,
    });
    res.json({ investments });
  })
);

// Aide de développement : simuler la confirmation du paiement depuis l’UI.
router.post(
  "/mock/confirm",
  requireAuth,
  requireNotAdmin,
  asyncHandler(async (req, res) => {
    const result = await investmentService.confirmMockPaymentFromClient(req.body || {});
    res.json(result);
  })
);

router.post(
  "/:id/cancel",
  requireAuth,
  requireNotAdmin,
  asyncHandler(async (req, res) => {
    const investment = await investmentService.cancelInvestment({
      investorId: req.user.id,
      investmentId: req.params.id,
    });
    res.json({ investment, message: "Investissement annulé." });
  })
);

router.post(
  "/:id/retry",
  requireAuth,
  requireNotAdmin,
  asyncHandler(async (req, res) => {
    const result = await investmentService.retryInvestmentPayment({
      investorId: req.user.id,
      investmentId: req.params.id,
    });
    res.json(result);
  })
);

module.exports = router;

