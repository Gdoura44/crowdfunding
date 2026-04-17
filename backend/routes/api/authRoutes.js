const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const HttpError = require("../../utils/HttpError");
const {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../../validators/authSchemas");
const authService = require("../../services/authService");
const {
  requireAuth,
  readRefreshToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} = require("../../middleware/auth");
const {
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
} = require("../../utils/cookieOptions");

const router = express.Router();

function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, "Validation failed", result.error.flatten());
  }
  return result.data;
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const data = parseBody(registerSchema, req.body);
    const out = await authService.registerUser(data);
    res.status(201).json({
      message:
        "Account created. Check your email for the verification link (or server console in development).",
      userId: out.userId,
      email: out.email,
    });
  })
);

router.get(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const data = parseBody(verifyEmailSchema, { token: req.query.token });
    await authService.verifyEmailWithToken(data.token);
    res.json({ message: "E-mail vérifié. Vous pouvez vous connecter." });
  })
);

router.post(
  "/resend-verification",
  asyncHandler(async (req, res) => {
    const data = parseBody(resendVerificationSchema, req.body);
    await authService.resendVerificationEmail(data.email);
    res.json({
      message:
        "Si un compte existe et n’est pas encore vérifié, un nouvel e-mail de vérification a été envoyé (ou affiché dans la console en mode dev).",
    });
  })
);

router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const data = parseBody(forgotPasswordSchema, req.body);
    await authService.requestPasswordReset(data.email);
    res.json({
      message:
        "Si un compte existe, vous recevrez un lien de réinitialisation (ou il sera affiché dans la console en mode dev).",
    });
  })
);

router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const data = parseBody(resetPasswordSchema, req.body);
    await authService.resetPasswordWithToken(data.token, data.password);
    res.json({ message: "Mot de passe mis à jour. Vous pouvez vous connecter." });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = parseBody(loginSchema, req.body);
    const { accessToken, refreshToken, user } = await authService.loginUser(
      data
    );
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, accessTokenCookieOptions());
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshTokenCookieOptions());
    res.json({
      message: "Connecté",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        profile: user.profile,
      },
    });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const refreshPlain = readRefreshToken(req);
    const device = req.body?.device;
    const { accessToken, refreshToken } = await authService.refreshSession(
      refreshPlain,
      device
    );
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, accessTokenCookieOptions());
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshTokenCookieOptions());
    res.json({ message: "Session refreshed" });
  })
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const refreshPlain = readRefreshToken(req);
    await authService.logoutUser(req.user.id, refreshPlain);
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: "/" });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/" });
    res.json({ message: "Signed out" });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const User = require("../../models/User");
    const user = await User.findById(req.user.id)
      .select("email role profile isActive createdAt deletedAt")
      .lean();
    if (!user || user.deletedAt) {
      throw new HttpError(404, "User not found");
    }
    res.json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        profile: user.profile,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  })
);

module.exports = router;
