const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { requireAuth } = require("../../middleware/auth");
const invoiceService = require("../../services/invoiceService");

const router = express.Router();

/**
 * GET /api/invoices
 * Lists all invoices for the authenticated user
 */
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const invoices = await invoiceService.listMyInvoices(req.user.id, {
      limit: req.query.limit,
    });
    res.json({ invoices });
  })
);

/**
 * GET /api/invoices/:id
 * Retrieves the full realistic invoice details (including transaction breakdown)
 */
router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const invoice = await invoiceService.getInvoiceDetails(
      req.user.id,
      req.user.role,
      req.params.id
    );
    res.json({ invoice });
  })
);

module.exports = router;
