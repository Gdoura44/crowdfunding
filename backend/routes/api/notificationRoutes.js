const express = require("express");
const mongoose = require("mongoose");
const asyncHandler = require("../../middleware/asyncHandler");
const HttpError = require("../../utils/HttpError");
const { requireAuth } = require("../../middleware/auth");
const notificationService = require("../../services/notificationService");

const router = express.Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const limit = req.query.limit || 20;
    const notifications = await notificationService.listUserNotifications(
      req.user.id,
      { limit }
    );
    res.json({ notifications });
  })
);

router.patch(
  "/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Identifiant de notification invalide.");
    }
    const notification = await notificationService.markAsRead(
      req.user.id,
      req.params.id
    );
    res.json({ notification });
  })
);

// Alignement avec la conception: certains diagrammes de séquence utilisent PUT pour la même action.
router.put(
  "/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Identifiant de notification invalide.");
    }
    const notification = await notificationService.markAsRead(
      req.user.id,
      req.params.id
    );
    res.json({ notification });
  })
);

module.exports = router;

