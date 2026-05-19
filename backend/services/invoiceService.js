const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const Investment = require("../models/Investment");
const Payout = require("../models/Payout");
const Project = require("../models/Project");
const HttpError = require("../utils/HttpError");
const { PLATFORM_FEE_RATE } = require("../config/businessRules");

/**
 * Service to manage professional invoices (factures)
 */

async function createInvoiceForInvestment(investment, { session } = {}) {
  // If invoice already exists, do not duplicate
  const existing = await Invoice.findOne({
    type: "INVESTMENT",
    referenceId: investment._id,
  }).session(session || null);
  
  if (existing) return existing;

  const invoiceNumber = await Invoice.generateInvoiceNumber("INVESTMENT");

  const amount = Number(investment.amount);
  const tip = Number(investment.tipAmount || 0);

  // The voluntary tip represents the platform service fee (TTC)
  const fee = Number((tip / 1.19).toFixed(2)); // HT fee
  const tax = Number((tip - fee).toFixed(2));  // 19% TVA on tip
  const total = Number((amount + fee + tax).toFixed(2)); // Matches amount + tip exactly!

  const [invoice] = await Invoice.create(
    [
      {
        invoiceNumber,
        userId: investment.investorId,
        projectId: investment.projectId,
        type: "INVESTMENT",
        referenceId: investment._id,
        amount,
        fee,
        tax,
        total,
        status: investment.status === "PENDING_CONSULTATION" ? "PENDING" : "PAID",
        issuedAt: new Date(),
      },
    ],
    session ? { session } : undefined
  );

  return invoice;
}

async function createInvoiceForPayout(payout, { session } = {}) {
  const existing = await Invoice.findOne({
    type: "PAYOUT",
    referenceId: payout._id,
  }).session(session || null);

  if (existing) return existing;

  const project = await Project.findById(payout.projectId).session(session || null);
  if (!project) throw new HttpError(404, "Projet associé introuvable.");

  const invoiceNumber = await Invoice.generateInvoiceNumber("PAYOUT");

  // Under the hybrid model:
  // payout.amount is the total public funded amount (TTC, e.g. Goal / project.currentFunding)
  // project.realBudget is the net amount required by the creator (e.g. RealBudget)
  const raised = Number(payout.amount);
  const realBudget = project.realBudget ? Number(project.realBudget) : Math.round(raised * (1 - PLATFORM_FEE_RATE));
  
  // Platform fee is the difference (TTC)
  const totalTtcFee = Math.max(raised - realBudget, 0);
  const fee = Number((totalTtcFee / 1.19).toFixed(2)); // HT fee
  const tax = Number((totalTtcFee - fee).toFixed(2));  // 19% TVA
  const amount = realBudget; // The net payout base paid to the creator
  const total = Number((amount + fee + tax).toFixed(2)); // Equals total raised (payout.amount)

  const [invoice] = await Invoice.create(
    [
      {
        invoiceNumber,
        userId: payout.creatorId,
        projectId: payout.projectId,
        type: "PAYOUT",
        referenceId: payout._id,
        amount,
        fee,
        tax,
        total, // For Payouts, total represents the raised/funded campaign sum
        status: "PAID",
        issuedAt: new Date(),
      },
    ],
    session ? { session } : undefined
  );

  return invoice;
}

async function listMyInvoices(userId, { limit = 30 } = {}) {
  // Lazy-generate payout invoices for completed payouts that don't have one yet
  try {
    const completedPayouts = await Payout.find({ creatorId: userId, status: "COMPLETED" });
    for (const p of completedPayouts) {
      const exists = await Invoice.findOne({ type: "PAYOUT", referenceId: p._id });
      if (!exists) {
        await createInvoiceForPayout(p);
      }
    }
  } catch (err) {
    console.error("Error backfilling payout invoices:", err);
  }

  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 30;

  return Invoice.find({ userId })
    .populate({ path: "projectId", select: { title: 1, isCompany: 1, companyName: 1, companyMatricule: 1, companyRNE: 1 }, options: { lean: true } })
    .sort({ issuedAt: -1 })
    .limit(safeLimit)
    .lean();
}

async function getInvoiceDetails(userId, userRole, invoiceId) {
  if (!mongoose.isValidObjectId(invoiceId)) {
    throw new HttpError(400, "Identifiant de facture invalide.");
  }

  const invoice = await Invoice.findById(invoiceId)
    .populate({ path: "projectId", select: { title: 1, fundingGoal: 1, isCompany: 1, companyName: 1, companyMatricule: 1, companyRNE: 1 }, options: { lean: true } })
    .populate({ path: "userId", select: { email: 1, profile: 1 }, options: { lean: true } })
    .lean();

  if (!invoice) throw new HttpError(404, "Facture introuvable.");

  const isAdmin = ["ADMIN"].includes(userRole);
  const isOwner = String(invoice.userId?._id || invoice.userId) === String(userId);

  if (!isAdmin && !isOwner) {
    throw new HttpError(403, "Accès refusé à cette facture.");
  }

  // Retrieve transaction information depending on the type
  let transactionDetails = null;
  if (invoice.type === "INVESTMENT") {
    transactionDetails = await Investment.findById(invoice.referenceId).lean();
  } else {
    transactionDetails = await Payout.findById(invoice.referenceId).lean();
  }

  return {
    ...invoice,
    transactionDetails,
  };
}

module.exports = {
  createInvoiceForInvestment,
  createInvoiceForPayout,
  listMyInvoices,
  getInvoiceDetails,
};
