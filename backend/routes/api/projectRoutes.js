const express = require("express");
const mongoose = require("mongoose");
const asyncHandler = require("../../middleware/asyncHandler");
const HttpError = require("../../utils/HttpError");
const { requireAuth, optionalAuth } = require("../../middleware/auth");
const { requireNotAdmin } = require("../../middleware/requireNotAdmin");
const { createDraftSchema, updateProjectSchema } = require("../../validators/projectSchemas");
const projectService = require("../../services/projectService");
const Comment = require("../../models/Comment");
const User = require("../../models/User");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

const router = express.Router();

const commentsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 4,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?.id ? `u:${String(req.user.id)}` : ipKeyGenerator(req)),
  message: { message: "Vous commentez trop vite. Merci de patienter une minute." },
});

function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, "Validation failed", result.error.flatten());
  }
  return result.data;
}

router.post(
  "/",
  requireAuth,
  requireNotAdmin,
  asyncHandler(async (req, res) => {
    const data = parseBody(createDraftSchema, req.body);
    const project = await projectService.createDraftProject(
      req.user.id,
      data
    );
    res.status(201).json({ project });
  })
);

router.get(
  "/:id/edit",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Identifiant de projet invalide.");
    }
    const project = await projectService.getProjectForEdit(
      req.user.id,
      req.params.id
    );
    res.json({ project });
  })
);

router.put(
  "/:id",
  requireAuth,
  requireNotAdmin,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Identifiant de projet invalide.");
    }
    const data = parseBody(updateProjectSchema, req.body);
    const project = await projectService.updateProject(req.user.id, req.params.id, data);
    res.json({ project, message: "Projet mis à jour." });
  })
);

router.put(
  "/:id/resubmit",
  requireAuth,
  requireNotAdmin,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Identifiant de projet invalide.");
    }
    const data = parseBody(updateProjectSchema, req.body);
    const project = await projectService.resubmitRejectedProject(
      req.user.id,
      req.params.id,
      data
    );
    res.json({ project, message: "Projet renvoyé pour analyse et revue." });
  })
);

router.post(
  "/:id/archive",
  requireAuth,
  requireNotAdmin,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Identifiant de projet invalide.");
    }
    const project = await projectService.archiveProject(req.user.id, req.params.id);
    res.json({ project, message: "Projet archivé." });
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireNotAdmin,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Identifiant de projet invalide.");
    }
    await projectService.deleteProject(req.user.id, req.params.id);
    res.json({ message: "Projet supprimé." });
  })
);

router.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const list = await projectService.listMyProjects(req.user.id);
    res.json({ projects: list });
  })
);

router.get(
  "/public",
  asyncHandler(async (req, res) => {
    const projects = await projectService.listPublicProjects({
      limit: req.query.limit,
    });
    res.json({ projects });
  })
);

router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const projects = await projectService.searchPublicProjects(req.query);
    res.json({ projects });
  })
);

router.post(
  "/:id/submit-for-ai",
  requireAuth,
  requireNotAdmin,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Identifiant de projet invalide.");
    }
    const project = await projectService.submitProjectForAi(
      req.user.id,
      req.params.id
    );
    res.json({
      message:
        "Projet soumis. L’analyse automatique démarre ; le statut sur la fiche sera mis à jour sous peu.",
      project,
    });
  })
);

router.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Identifiant de projet invalide.");
    }
    const userId = req.user?.id || null;
    const { project, isOwner } = await projectService.getProjectById(
      req.params.id,
      userId
    );
    res.json({ project, isOwner });
  })
);

router.get(
  "/:id/comments",
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Identifiant de projet invalide.");
    }
    const userId = req.user?.id || null;
    const { project, isOwner } = await projectService.getProjectById(req.params.id, userId);
    if (!isOwner && (project.status !== "ACTIVE" || project.isArchived)) {
      throw new HttpError(404, "Projet introuvable.");
    }

    const comments = await Comment.find({
      projectId: project._id,
      isHidden: false,
      deletedAt: { $exists: false },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ comments });
  })
);

router.post(
  "/:id/comments",
  requireAuth,
  requireNotAdmin,
  commentsLimiter,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Identifiant de projet invalide.");
    }
    const userId = req.user.id;
    const { project, isOwner } = await projectService.getProjectById(req.params.id, userId);
    if (isOwner) {
      throw new HttpError(400, "Vous ne pouvez pas commenter votre propre projet.");
    }
    if (project.status !== "ACTIVE" || project.isArchived) {
      throw new HttpError(409, "Commentaires indisponibles : la campagne n’est pas publique.");
    }

    const content = String(req.body?.content || "").trim();
    if (!content) {
      throw new HttpError(400, "Écrivez un commentaire avant d’envoyer.");
    }
    if (content.length > 1000) {
      throw new HttpError(400, "Commentaire trop long (1000 caractères maximum).");
    }

    let authorLabel = "Utilisateur";
    try {
      const u = await User.findById(userId).select({ email: 1 }).lean();
      if (u?.email) authorLabel = String(u.email);
    } catch {
      // Sans bloquer : si on ne peut pas récupérer l'e-mail, on garde un libellé générique.
    }

    const created = await Comment.create({
      projectId: project._id,
      userId,
      authorLabel,
      content,
    });

    res.status(201).json({
      comment: created.toObject ? created.toObject() : created,
      message: "Commentaire publié.",
    });
  })
);

router.delete(
  "/:projectId/comments/:commentId",
  requireAuth,
  requireNotAdmin,
  asyncHandler(async (req, res) => {
    const { projectId, commentId } = req.params;
    if (!mongoose.isValidObjectId(projectId)) {
      throw new HttpError(400, "Identifiant de projet invalide.");
    }
    if (!mongoose.isValidObjectId(commentId)) {
      throw new HttpError(400, "Identifiant de commentaire invalide.");
    }
    const userId = req.user.id;

    const comment = await Comment.findOne({ _id: commentId, projectId });
    if (!comment) throw new HttpError(404, "Commentaire introuvable.");
    if (comment.deletedAt) {
      return res.json({ message: "Commentaire déjà supprimé." });
    }
    if (String(comment.userId) !== String(userId)) {
      throw new HttpError(403, "Suppression impossible : ce commentaire ne vous appartient pas.");
    }

    comment.deletedAt = new Date();
    comment.deletedBy = userId;
    comment.deletedByRole = "USER";
    comment.isHidden = true;
    comment.hiddenReason = "Supprimé par l’auteur";
    comment.hiddenAt = new Date();
    comment.hiddenBy = userId;
    await comment.save();

    res.json({ message: "Commentaire supprimé." });
  })
);

module.exports = router;
