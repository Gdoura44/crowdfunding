const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { requireAuth } = require("../../middleware/auth");
const { requireNotAdmin } = require("../../middleware/requireNotAdmin");
const recommendationService = require("../../services/recommendationService");

const router = express.Router();

router.get(
  "/",
  requireAuth,
  requireNotAdmin,
  asyncHandler(async (req, res) => {
    const projects = await recommendationService.getRecommendationsForUser(req.user.id, {
      limit: req.query.limit,
    });
    res.json({ projects });
  })
);

module.exports = router;

