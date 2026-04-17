const express = require("express");
const mongoose = require("mongoose");
const asyncHandler = require("../../middleware/asyncHandler");
const HttpError = require("../../utils/HttpError");
const { requireAuth, optionalAuth } = require("../../middleware/auth");
const { requireNotAdmin } = require("../../middleware/requireNotAdmin");
const { createDraftSchema, updateProjectSchema } = require("../../validators/projectSchemas");
const projectService = require("../../services/projectService");

const router = express.Router();

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
      throw new HttpError(400, "Invalid project id");
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
      throw new HttpError(400, "Invalid project id");
    }
    const data = parseBody(updateProjectSchema, req.body);
    const project = await projectService.updateProject(req.user.id, req.params.id, data);
    res.json({ project, message: "Project updated" });
  })
);

router.put(
  "/:id/resubmit",
  requireAuth,
  requireNotAdmin,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Invalid project id");
    }
    const data = parseBody(updateProjectSchema, req.body);
    const project = await projectService.resubmitRejectedProject(
      req.user.id,
      req.params.id,
      data
    );
    res.json({ project, message: "Project resubmitted for review" });
  })
);

router.post(
  "/:id/archive",
  requireAuth,
  requireNotAdmin,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Invalid project id");
    }
    const project = await projectService.archiveProject(req.user.id, req.params.id);
    res.json({ project, message: "Project archived" });
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireNotAdmin,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Invalid project id");
    }
    await projectService.deleteProject(req.user.id, req.params.id);
    res.json({ message: "Project deleted" });
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
      throw new HttpError(400, "Invalid project id");
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
      throw new HttpError(400, "Invalid project id");
    }
    const userId = req.user?.id || null;
    const { project, isOwner } = await projectService.getProjectById(
      req.params.id,
      userId
    );
    res.json({ project, isOwner });
  })
);

module.exports = router;
