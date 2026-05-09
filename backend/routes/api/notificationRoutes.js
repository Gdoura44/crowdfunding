const express = require("express");
const mongoose = require("mongoose");
const asyncHandler = require("../../middleware/asyncHandler");
const HttpError = require("../../utils/HttpError");
const { requireAuth } = require("../../middleware/auth");
const notificationService = require("../../services/notificationService");

const router = express.Router();

function parseNotificationListQuery(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const max = notificationService.MAX_LIST_PAGE_SIZE;
  const rawLimit = parseInt(req.query.limit, 10);
  const pageSize = Number.isFinite(rawLimit) ? Math.min(max, Math.max(1, rawLimit)) : max;
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
}

/** Boîte personnelle du compte connecté (tous rôles, y compris admin). */
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip } = parseNotificationListQuery(req);

    const [rows, unreadCount] = await Promise.all([
      notificationService.listUserNotifications(req.user.id, {
        limit: pageSize + 1,
        skip,
        unreadOnly: req.query.unreadOnly,
      }),
      notificationService.countUserUnread(req.user.id),
    ]);
    const hasMore = rows.length > pageSize;
    const notifications = hasMore ? rows.slice(0, pageSize) : rows;
    res.json({ notifications, unreadCount, page, pageSize, hasMore });
  })
);

router.put(
  "/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Identifiant de notification invalide.");
    }
    const notification = await notificationService.markAsRead(req.user.id, req.params.id);
    res.json({ notification });
  })
);

module.exports = router;

