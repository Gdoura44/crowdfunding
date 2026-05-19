const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { requireAuth } = require("../../middleware/auth");
const { requireExpert } = require("../../middleware/requireExpert");
const HttpError = require("../../utils/HttpError");
const expertService = require("../../services/expertService");

const router = express.Router();

// ---------------------------------------------------------------------------
// Routes expert : validation de l'analyse IA
// ---------------------------------------------------------------------------

/**
 * GET /api/expert/projects
 * Liste les projets UNDER_REVIEW pour que l'expert puisse les traiter.
 */
router.get(
  "/projects",
  requireAuth,
  requireExpert,
  asyncHandler(async (req, res) => {
    const projects = await expertService.listProjectsForExpert({
      limit: req.query.limit,
    });
    res.json({ projects });
  })
);

/**
 * POST /api/expert/projects/:id/validate
 * L'expert valide ou rejette l'analyse IA d'un projet.
 * Body: { decision: "APPROVED" | "REJECTED", feedback?: string }
 *
 * Note : l'expert ne peut PAS publier un projet. La publication reste admin.
 */
router.post(
  "/projects/:id/validate",
  requireAuth,
  requireExpert,
  asyncHandler(async (req, res) => {
    const { decision, feedback } = req.body || {};
    if (!decision) {
      throw new HttpError(400, "Le champ « decision » est requis (APPROVED ou REJECTED).");
    }
    const project = await expertService.validateProjectAnalysis({
      expertId: req.user.id,
      projectId: req.params.id,
      decision,
      feedback,
    });
    res.json({
      project,
      message:
        String(decision).toUpperCase() === "APPROVED"
          ? "Analyse validée. Le projet passe en statut APPROVED, en attente de publication par un administrateur."
          : "Analyse annulée. Le créateur recevra une notification avec le motif.",
    });
  })
);

// ---------------------------------------------------------------------------
// Routes consultation investisseur ↔ expert
// ---------------------------------------------------------------------------

/**
 * GET /api/expert/consultations
 * - Expert/Admin : liste toutes les consultations (filtrables par status).
 * - Investisseur : liste ses consultations personnelles.
 */
router.get(
  "/consultations",
  requireAuth,
  asyncHandler(async (req, res) => {
    const isExpert = ["EXPERT", "ADMIN"].includes(req.user.role);
    if (isExpert) {
      const consultations = await expertService.listExpertConsultations({
        status: req.query.status,
        limit: req.query.limit,
      });
      return res.json({ consultations });
    }
    const consultations = await expertService.listInvestorConsultations({
      investorId: req.user.id,
      status: req.query.status,
      limit: req.query.limit,
    });
    return res.json({ consultations });
  })
);

/**
 * GET /api/expert/consultations/:id
 * Récupère le détail d'une consultation (accès contrôlé : investisseur propriétaire ou expert).
 */
router.get(
  "/consultations/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const consultation = await expertService.getConsultation({
      userId: req.user.id,
      userRole: req.user.role,
      consultationId: req.params.id,
    });
    res.json({ consultation });
  })
);

/**
 * POST /api/expert/consultations/:id/messages
 * Ajoute un message (investisseur ou expert).
 * Body: { content }
 */
router.post(
  "/consultations/:id/messages",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { content } = req.body || {};
    if (!content) throw new HttpError(400, "Le champ « content » est requis.");
    const consultation = await expertService.addMessage({
      userId: req.user.id,
      userRole: req.user.role,
      consultationId: req.params.id,
      content,
    });
    res.json({ consultation, message: "Message envoyé." });
  })
);

/**
 * POST /api/expert/consultations/:id/close
 * Clôture une consultation (expert ou investisseur propriétaire).
 */
router.post(
  "/consultations/:id/close",
  requireAuth,
  asyncHandler(async (req, res) => {
    const consultation = await expertService.closeConsultation({
      userId: req.user.id,
      userRole: req.user.role,
      consultationId: req.params.id,
    });
    res.json({ consultation, message: "Consultation clôturée." });
  })
);

module.exports = router;
