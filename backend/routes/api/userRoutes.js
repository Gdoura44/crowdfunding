const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const HttpError = require("../../utils/HttpError");
const { requireAuth } = require("../../middleware/auth");
const { updateProfileSchema } = require("../../validators/userSchemas");
const User = require("../../models/User");
const { writeAudit } = require("../../services/auditService");
const accountService = require("../../services/accountService");

const router = express.Router();

function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, "Validation failed", result.error.flatten());
  }
  return result.data;
}

router.get(
  "/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id)
      .select("email role profile createdAt deletedAt")
      .lean();
    if (!user || user.deletedAt) throw new HttpError(404, "User not found");
    res.json({
      profile: user.profile,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });
  })
);

router.put(
  "/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = parseBody(updateProfileSchema, req.body);
    const user = await User.findById(req.user.id);
    if (!user || user.deletedAt) throw new HttpError(404, "User not found");

    user.profile = {
      ...user.profile?.toObject?.(),
      ...data,
    };
    await user.save();

    await writeAudit({
      actorId: req.user.id,
      actorRole: "USER",
      action: "UPDATE_PROFILE",
      targetType: "User",
      targetId: user._id,
      details: { fields: Object.keys(data || {}) },
    });

    res.json({ message: "Profile updated", profile: user.profile });
  })
);

router.post(
  "/delete-account",
  requireAuth,
  asyncHandler(async (req, res) => {
    await accountService.deleteAccount({ userId: req.user.id });
    res.json({ ok: true, message: "Account deleted successfully" });
  })
);

module.exports = router;

