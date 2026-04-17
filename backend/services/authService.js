const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const HttpError = require("../utils/HttpError");
const { randomUrlToken, sha256Hex } = require("../utils/cryptoTokens");
const { sendMail } = require("../utils/email");
const { MAX_REFRESH_TOKENS } = require("../config/constants");

const BCRYPT_ROUNDS = 10;
const VERIFY_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function getJwtSecrets() {
  const access = process.env.JWT_ACCESS_SECRET;
  const refresh = process.env.JWT_REFRESH_SECRET || access;
  if (!access) {
    throw new Error("JWT_ACCESS_SECRET is required");
  }
  return { access, refresh };
}

function signAccessToken(user) {
  const { access } = getJwtSecrets();
  return jwt.sign(
    { sub: String(user._id), role: user.role },
    access,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m" }
  );
}

async function trySendMailOrFallback({ mail, devLinkLogLabel, link }) {
  try {
    await sendMail(mail);
    return { ok: true };
  } catch (err) {
    // In dev/PFE, email delivery shouldn't block core flows.
    // We still show the verification link in logs so the user can verify.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[email] Send failed in dev; using link fallback:", err?.message || err);
      if (link) console.info(devLinkLogLabel, link);
      return { ok: false, devFallback: true };
    }
    throw new HttpError(502, "Email service unavailable. Please try again later.");
  }
}

async function registerUser({ email, password, firstName, lastName, phone }) {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new HttpError(409, "Email already registered");
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const verifyPlain = randomUrlToken(24);
  const verifyTokenHash = sha256Hex(verifyPlain);
  const verifyTokenExpiry = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);

  const user = await User.create({
    email: email.toLowerCase(),
    passwordHash,
    role: "USER",
    isActive: false,
    verifyTokenHash,
    verifyTokenExpiry,
    profile: { firstName: firstName || "", lastName: lastName || "", phone: phone || "" },
  });

  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const link = `${baseUrl}/verify-email?token=${verifyPlain}`;

  await trySendMailOrFallback({
    mail: {
      to: user.email,
      subject: "Verify your account",
      text: `Open this link to verify your email: ${link}`,
      html: `<p>Open this link to verify your email:</p><p><a href="${link}">${link}</a></p>`,
    },
    devLinkLogLabel: "[auth] Dev verification link:",
    link,
  });

  return { userId: user._id, email: user.email };
}

async function verifyEmailWithToken(plainToken) {
  if (!plainToken) {
    throw new HttpError(400, "Token is required");
  }
  const hash = sha256Hex(plainToken);
  const user = await User.findOne({
    verifyTokenHash: hash,
    verifyTokenExpiry: { $gt: new Date() },
    deletedAt: null,
  });
  if (!user) {
    throw new HttpError(400, "Invalid or expired verification token");
  }
  user.isActive = true;
  user.verifyTokenHash = null;
  user.verifyTokenExpiry = null;
  await user.save();
  return { userId: user._id };
}

async function resendVerificationEmail(email) {
  const user = await User.findOne({
    email: String(email || "").toLowerCase(),
    deletedAt: null,
  });
  if (!user) {
    // Do not leak whether email exists.
    return { ok: true };
  }
  if (user.isActive) {
    return { ok: true };
  }

  const verifyPlain = randomUrlToken(24);
  user.verifyTokenHash = sha256Hex(verifyPlain);
  user.verifyTokenExpiry = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
  await user.save();

  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const link = `${baseUrl}/verify-email?token=${verifyPlain}`;

  await trySendMailOrFallback({
    mail: {
      to: user.email,
      subject: "Vérifiez votre compte",
      text: `Ouvrez ce lien pour vérifier votre e-mail : ${link}`,
      html: `<p>Ouvrez ce lien pour vérifier votre e-mail :</p><p><a href="${link}">${link}</a></p>`,
    },
    devLinkLogLabel: "[auth] Dev verification link (resend):",
    link,
  });

  return { ok: true };
}

async function requestPasswordReset(email) {
  const user = await User.findOne({
    email: String(email || "").toLowerCase(),
    deletedAt: null,
  });
  if (!user) {
    // Do not leak whether email exists.
    return { ok: true };
  }

  const plain = randomUrlToken(32);
  user.resetTokenHash = sha256Hex(plain);
  user.resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save();

  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const link = `${baseUrl}/reset-password?token=${plain}`;

  await trySendMailOrFallback({
    mail: {
      to: user.email,
      subject: "Réinitialisation du mot de passe",
      text: `Ouvrez ce lien pour réinitialiser votre mot de passe : ${link}`,
      html: `<p>Ouvrez ce lien pour réinitialiser votre mot de passe :</p><p><a href="${link}">${link}</a></p>`,
    },
    devLinkLogLabel: "[auth] Dev reset link:",
    link,
  });

  return { ok: true };
}

async function resetPasswordWithToken(plainToken, newPassword) {
  if (!plainToken) throw new HttpError(400, "Token is required");
  const hash = sha256Hex(plainToken);
  const user = await User.findOne({
    resetTokenHash: hash,
    resetTokenExpiry: { $gt: new Date() },
    deletedAt: null,
  });
  if (!user) {
    throw new HttpError(400, "Invalid or expired reset token");
  }
  user.passwordHash = await bcrypt.hash(String(newPassword), BCRYPT_ROUNDS);
  user.resetTokenHash = null;
  user.resetTokenExpiry = null;
  // Invalidate refresh tokens (force new login everywhere).
  user.refreshTokens = [];
  await user.save();
  return { ok: true };
}

async function loginUser({ email, password, device }) {
  const user = await User.findOne({
    email: email.toLowerCase(),
    deletedAt: null,
  });
  if (!user) {
    throw new HttpError(401, "Invalid email or password");
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new HttpError(401, "Invalid email or password");
  }
  if (!user.isActive) {
    throw new HttpError(403, "Account not verified or inactive");
  }

  const refreshPlain = randomUrlToken(32);
  const refreshHash = sha256Hex(refreshPlain);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  user.refreshTokens.push({
    tokenHash: refreshHash,
    expiresAt,
    device: device || "",
  });
  user.refreshTokens.sort((a, b) => a.expiresAt - b.expiresAt);
  while (user.refreshTokens.length > MAX_REFRESH_TOKENS) {
    user.refreshTokens.shift();
  }
  await user.save();

  const accessToken = signAccessToken(user);
  return { accessToken, refreshToken: refreshPlain, user };
}

async function refreshSession(refreshPlain, device) {
  if (!refreshPlain) {
    throw new HttpError(401, "Refresh token missing");
  }
  const hash = sha256Hex(refreshPlain);
  const user = await User.findOne({
    "refreshTokens.tokenHash": hash,
    deletedAt: null,
    isActive: true,
  });
  if (!user) {
    throw new HttpError(401, "Invalid refresh token");
  }

  const entry = user.refreshTokens.find((t) => t.tokenHash === hash);
  if (!entry || entry.expiresAt < new Date()) {
    throw new HttpError(401, "Refresh token expired");
  }

  user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== hash);

  const newPlain = randomUrlToken(32);
  const newHash = sha256Hex(newPlain);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  user.refreshTokens.push({
    tokenHash: newHash,
    expiresAt,
    device: device || entry.device || "",
  });
  user.refreshTokens.sort((a, b) => a.expiresAt - b.expiresAt);
  while (user.refreshTokens.length > MAX_REFRESH_TOKENS) {
    user.refreshTokens.shift();
  }
  await user.save();

  return { accessToken: signAccessToken(user), refreshToken: newPlain };
}

async function logoutUser(userId, refreshPlain) {
  if (!refreshPlain) return;
  const hash = sha256Hex(refreshPlain);
  await User.updateOne(
    { _id: userId },
    { $pull: { refreshTokens: { tokenHash: hash } } }
  );
}

module.exports = {
  registerUser,
  verifyEmailWithToken,
  resendVerificationEmail,
  requestPasswordReset,
  resetPasswordWithToken,
  loginUser,
  refreshSession,
  logoutUser,
  signAccessToken,
};
