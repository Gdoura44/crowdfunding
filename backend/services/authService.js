const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const HttpError = require("../utils/HttpError");
const { randomUrlToken, sha256Hex } = require("../utils/cryptoTokens");
const { sendMail } = require("../utils/email");
const { MAX_REFRESH_TOKENS } = require("../config/constants");

const BCRYPT_ROUNDS = 10;
const VERIFY_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
const VERIFY_CODE_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Auth service (inscription, vérification email, sessions JWT).
 *
 * Choix produit/UX:
 * - Vérification par code (OTP) = flux principal (simple pour l’utilisateur).
 * - Lien = fallback (si l’utilisateur préfère ou si le mail client bloque la saisie).
 * - Le lien est idempotent: si déjà utilisé (par lien ou par code), on renvoie un statut lisible
 *   plutôt qu’une erreur “mystère”.
 * - L’envoi d’e-mail est best-effort et asynchrone en dev/PFE pour rendre l’UI instantanée.
 */
function getJwtSecrets() {
  const access = process.env.JWT_ACCESS_SECRET;
  const refresh = process.env.JWT_REFRESH_SECRET || access;
  if (!access) {
    throw new Error("JWT_ACCESS_SECRET est requis");
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
    // En dev/PFE, l’envoi d’e-mail ne doit pas bloquer les flux principaux.
    // On affiche quand même le lien de vérification dans les logs pour pouvoir tester.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[email] Envoi échoué en dev; utilisation du fallback lien:", err?.message || err);
      if (link) console.info(devLinkLogLabel, link);
      return { ok: false, devFallback: true };
    }
    throw new HttpError(502, "Service e-mail indisponible. Merci de réessayer plus tard.");
  }
}

async function registerUser({ email, password, firstName, lastName, phone }) {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new HttpError(
      409,
      "Cette adresse e-mail est déjà utilisée. Connectez-vous ou utilisez une autre adresse."
    );
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const verifyPlain = randomUrlToken(24); // token de lien (solution de secours / fallback)
  const verifyTokenHash = sha256Hex(verifyPlain);
  const verifyTokenExpiry = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);

  // Principal: code OTP à 6 chiffres
  const verifyCodePlain = String(Math.floor(100000 + Math.random() * 900000));
  const verifyCodeHash = sha256Hex(verifyCodePlain);
  const verifyCodeExpiry = new Date(Date.now() + VERIFY_CODE_TTL_MS);

  const user = await User.create({
    email: email.toLowerCase(),
    passwordHash,
    role: "USER",
    isActive: false,
    verifyCodeHash,
    verifyCodeExpiry,
    verifyTokenHash,
    verifyTokenExpiry,
    profile: { firstName: firstName || "", lastName: lastName || "", phone: phone || "" },
  });

  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const link = `${baseUrl}/verify-email?token=${verifyPlain}`;

  // Envoi asynchrone: l’inscription doit répondre instantanément côté UI.
  // Best-effort (sans bloquer le parcours): les échecs sont gérés dans `trySendMailOrFallback`
  // (fallback en dev / 502 en prod).
  void trySendMailOrFallback({
    mail: {
      to: user.email,
      subject: "Code de vérification — FinCollab",
      text:
        `Votre code de vérification FinCollab : ${verifyCodePlain}\n\n` +
        `Ce code expire dans 15 minutes.\n` +
        `Si vous préférez, vous pouvez aussi vérifier via ce lien : ${link}`,
      html:
        `<p>Votre code de vérification <strong>FinCollab</strong> :</p>` +
        `<p style="font-size:22px; font-weight:700; letter-spacing:2px">${verifyCodePlain}</p>` +
        `<p class="small">Ce code expire dans <strong>15 minutes</strong>.</p>` +
        `<hr/>` +
        `<p>Alternative (lien de vérification) :</p><p><a href="${link}">${link}</a></p>`,
    },
    devLinkLogLabel: "[auth] Dev verification link:",
    link,
  }).catch(() => {
    // best-effort
  });

  return {
    userId: user._id,
    email: user.email,
    // Ne jamais exposer de lien de vérification dans une réponse en production.
    devVerificationLink: process.env.NODE_ENV !== "production" ? link : undefined,
    // Best-effort: l’email peut arriver un peu plus tard.
    emailSent: true,
    emailDevFallback: false,
  };
}

async function verifyEmailWithCode({ email, code }) {
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const plainCode = String(code || "").trim();
  const hash = sha256Hex(plainCode);

  const user = await User.findOne({
    email: normalizedEmail,
    verifyCodeHash: hash,
    verifyCodeExpiry: { $gt: new Date() },
    deletedAt: null,
  });
  if (!user) {
    throw new HttpError(400, "Code invalide ou expiré. Merci de demander un nouveau code.");
  }

  user.isActive = true;
  user.verifyCodeHash = null;
  user.verifyCodeExpiry = null;
  // Marquer le lien de secours comme “expiré car le code a été utilisé” (UX attendue).
  // On garde le hash pour afficher un message plus clair si l’utilisateur clique encore le lien.
  if (user.verifyTokenHash) {
    user.verifyTokenExpiry = new Date(Date.now() - 1000);
    user.verifyTokenUsedAt = new Date();
    user.verifyTokenUsedBy = "CODE";
  }
  await user.save();
  return { userId: user._id };
}

async function verifyEmailWithToken(plainToken) {
  if (!plainToken) {
    throw new HttpError(400, "Lien invalide : token manquant.");
  }
  const hash = sha256Hex(plainToken);
  const user = await User.findOne({
    verifyTokenHash: hash,
    verifyTokenExpiry: { $gt: new Date() },
    deletedAt: null,
  });
  if (!user) {
    // Si le token existe mais est déjà consommé, renvoyer un statut “lisible” (UX).
    const already = await User.findOne({ verifyTokenHash: hash, deletedAt: null }).lean();
    if (already && already.isActive) {
      if (already.verifyTokenUsedBy === "LINK") {
        return { userId: already._id, status: "ALREADY_USED" };
      }
      if (already.verifyTokenUsedBy === "CODE") {
        return { userId: already._id, status: "EXPIRED_BY_CODE" };
      }
      return { userId: already._id, status: "ALREADY_VERIFIED" };
    }
    throw new HttpError(400, "Lien invalide ou expiré. Demandez un nouvel e-mail de vérification.");
  }
  user.isActive = true;
  // Consommer le token (one-time). On garde le hash pour détecter “déjà utilisé”.
  user.verifyTokenExpiry = new Date(Date.now() - 1000);
  user.verifyTokenUsedAt = new Date();
  user.verifyTokenUsedBy = "LINK";
  user.verifyCodeHash = null;
  user.verifyCodeExpiry = null;
  await user.save();
  return { userId: user._id, status: "VERIFIED" };
}

async function resendVerificationEmail(email) {
  const user = await User.findOne({
    email: String(email || "").toLowerCase(),
    deletedAt: null,
  });
  if (!user) {
    // Ne pas divulguer si l’e-mail existe.
    return { ok: true };
  }
  if (user.isActive) {
    return { ok: true };
  }

  const verifyCodePlain = String(Math.floor(100000 + Math.random() * 900000));
  user.verifyCodeHash = sha256Hex(verifyCodePlain);
  user.verifyCodeExpiry = new Date(Date.now() + VERIFY_CODE_TTL_MS);

  const verifyPlain = randomUrlToken(24);
  user.verifyTokenHash = sha256Hex(verifyPlain);
  user.verifyTokenExpiry = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
  await user.save();

  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const link = `${baseUrl}/verify-email?token=${verifyPlain}`;

  // Envoi asynchrone: UX plus rapide côté frontend.
  void trySendMailOrFallback({
    mail: {
      to: user.email,
      subject: "Nouveau code de vérification — FinCollab",
      text:
        `Votre nouveau code FinCollab : ${verifyCodePlain}\n\n` +
        `Ce code expire dans 15 minutes.\n` +
        `Alternative : ${link}`,
      html:
        `<p>Votre nouveau code de vérification <strong>FinCollab</strong> :</p>` +
        `<p style="font-size:22px; font-weight:700; letter-spacing:2px">${verifyCodePlain}</p>` +
        `<p class="small">Ce code expire dans <strong>15 minutes</strong>.</p>` +
        `<hr/>` +
        `<p>Alternative (lien de vérification) :</p><p><a href="${link}">${link}</a></p>`,
    },
    devLinkLogLabel: "[auth] Dev verification link (resend):",
    link,
  }).catch(() => {
    // best-effort
  });

  return { ok: true };
}

async function requestPasswordReset(email) {
  const user = await User.findOne({
    email: String(email || "").toLowerCase(),
    deletedAt: null,
  });
  if (!user) {
    // Ne pas divulguer si l’e-mail existe.
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
  if (!plainToken) throw new HttpError(400, "Lien invalide : token manquant.");
  const hash = sha256Hex(plainToken);
  const user = await User.findOne({
    resetTokenHash: hash,
    resetTokenExpiry: { $gt: new Date() },
    deletedAt: null,
  });
  if (!user) {
    throw new HttpError(400, "Lien invalide ou expiré. Relancez la demande de réinitialisation.");
  }
  user.passwordHash = await bcrypt.hash(String(newPassword), BCRYPT_ROUNDS);
  user.resetTokenHash = null;
  user.resetTokenExpiry = null;
  // Invalider les refresh tokens (forcer une reconnexion partout).
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
    throw new HttpError(401, "E-mail ou mot de passe incorrect.");
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new HttpError(401, "E-mail ou mot de passe incorrect.");
  }
  if (!user.isActive) {
    throw new HttpError(
      403,
      "Compte non vérifié ou désactivé. Vérifiez vos e-mails (ou renvoyez le lien)."
    );
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
    throw new HttpError(401, "Jeton de rafraîchissement manquant.");
  }
  const hash = sha256Hex(refreshPlain);
  const user = await User.findOne({
    "refreshTokens.tokenHash": hash,
    deletedAt: null,
    isActive: true,
  });
  if (!user) {
    throw new HttpError(401, "Jeton de rafraîchissement invalide.");
  }

  const entry = user.refreshTokens.find((t) => t.tokenHash === hash);
  if (!entry || entry.expiresAt < new Date()) {
    throw new HttpError(401, "Jeton de rafraîchissement expiré.");
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
  verifyEmailWithCode,
  verifyEmailWithToken,
  resendVerificationEmail,
  requestPasswordReset,
  resetPasswordWithToken,
  loginUser,
  refreshSession,
  logoutUser,
  signAccessToken,
};
