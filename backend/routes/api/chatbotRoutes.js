const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("../../middleware/asyncHandler");
const { requireAuth } = require("../../middleware/auth");
const HttpError = require("../../utils/HttpError");
const Project = require("../../models/Project");
const { generateGeminiText } = require("../../services/geminiChatService");

const router = express.Router();

// 10/hour per user. Note: this is in-memory rate limiting (acceptable for PFE demo).
const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || rateLimit.ipKeyGenerator(req),
  message: { message: "Trop de questions. Réessayez plus tard." },
});

router.post(
  "/projects/:id/chat",
  requireAuth,
  chatLimiter,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid project id");
    const question = String(req.body?.question || "").trim();
    if (!question) throw new HttpError(400, "question is required");
    if (question.length > 800) throw new HttpError(400, "question is too long");

    const project = await Project.findById(req.params.id)
      .select("title description category fundingGoal currentFunding deadline status")
      .lean();
    if (!project) throw new HttpError(404, "Project not found");

    const fundingGoal = Number(project.fundingGoal || 0);
    const currentFunding = Number(project.currentFunding || 0);
    const progressPct =
      fundingGoal > 0 ? Math.max(0, Math.min(100, Math.round((currentFunding / fundingGoal) * 100))) : null;

    const platformRules = [
      "- Réponds en français, clair et concis.",
      "- Utilise UNIQUEMENT les infos fournies ci-dessous (ne pas inventer).",
      "- Si la question demande une info absente, dis-le et propose quoi vérifier sur la page.",
      "- Ne donne pas de conseil financier; reste informatif.",
      "- Mentionne brièvement les règles: annulation courte après paiement (si applicable), sur-financement = remboursement, projet expiré = remboursement.",
      "- Réponds en 6 à 10 lignes maximum.",
    ].join("\n");

    const projectContext = [
      `Titre: ${project.title || ""}`,
      `Statut: ${project.status || ""}`,
      `Catégorie: ${project.category || ""}`,
      `Objectif: ${fundingGoal || ""} TND`,
      `Collecté: ${currentFunding || ""} TND`,
      `Avancement: ${progressPct == null ? "N/A" : `${progressPct}%`}`,
      `Deadline: ${project.deadline ? new Date(project.deadline).toISOString() : ""}`,
      `Description: ${String(project.description || "").slice(0, 6000)}`,
    ].join("\n");

    const prompt = [
      "Tu es l’assistant de la plateforme FinCollab (crowdfunding).",
      platformRules,
      "",
      "Contexte projet (source: base de données):",
      projectContext,
      "",
      `Question utilisateur: ${question}`,
    ].join("\n");

    try {
      const answer = await generateGeminiText(prompt);
      res.json({ answer });
    } catch (err) {
      // Fallback: keep UX usable even if Gemini is down/quota exceeded.
      const safeAnswer = [
        `Projet: ${project.title}.`,
        `Statut: ${project.status}.`,
        progressPct == null
          ? `Objectif: ${fundingGoal || "N/A"} TND.`
          : `Avancement: ${progressPct}% (${currentFunding}/${fundingGoal} TND).`,
        project.deadline ? `Date limite: ${new Date(project.deadline).toLocaleDateString("fr-FR")}.` : "",
        "Règles: annulation courte après paiement (si applicable), sur-financement = remboursement, projet expiré = remboursement.",
        "Je peux répondre plus précisément si vous me dites ce que vous voulez savoir (objectif, avancement, date limite, statut, etc.).",
      ]
        .filter(Boolean)
        .join(" ");
      res.json({ answer: safeAnswer });
    }
  })
);

module.exports = router;

