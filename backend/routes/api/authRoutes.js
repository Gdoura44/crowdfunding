const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const HttpError = require("../../utils/HttpError");
const {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  verifyEmailCodeSchema,
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
        "Compte créé. Vérifiez votre e-mail pour le code de vérification.",
      userId: out.userId,
      email: out.email,
      devVerificationLink: out.devVerificationLink,
      emailSent: out.emailSent,
      emailDevFallback: out.emailDevFallback,
    });
  })
);

router.get(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const data = parseBody(verifyEmailSchema, { token: req.query.token });
    const out = await authService.verifyEmailWithToken(data.token);
    const status = out?.status || "VERIFIED";
    const msg =
      status === "ALREADY_USED"
        ? "Ce lien a déjà été utilisé. Votre compte est déjà vérifié."
        : status === "EXPIRED_BY_CODE"
          ? "Ce lien a expiré car votre compte a déjà été vérifié avec un code."
          : status === "ALREADY_VERIFIED"
            ? "Votre compte est déjà vérifié. Vous pouvez vous connecter."
            : "E-mail vérifié. Vous pouvez vous connecter.";
    res.json({ message: msg, status });
  })
);

router.post(
  "/verify-email-code",
  asyncHandler(async (req, res) => {
    const data = parseBody(verifyEmailCodeSchema, req.body);
    await authService.verifyEmailWithCode({ email: data.email, code: data.code });
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
        "Si un compte existe et n’est pas encore vérifié, un e-mail de vérification sera envoyé dans quelques instants.",
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
        "Si un compte existe, vous recevrez un lien de réinitialisation dans quelques instants.",
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
    res.json({ message: "Session prolongée." });
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
    res.json({ message: "Déconnecté." });
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
      throw new HttpError(404, "Utilisateur introuvable.");
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
