const jwt = require("jsonwebtoken");
const {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} = require("../config/constants");

function readAccessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET est requis");
  }
  return secret;
}

function optionalAuth(req, res, next) {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE];
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const payload = jwt.verify(token, readAccessSecret());
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    // Important: si un token est présent mais invalide/expiré, renvoyer 401 pour que le client
    // puisse rafraîchir la session (interceptor axios) au lieu de retomber silencieusement
    // en “anonyme” et produire des 404 confus sur des ressources “propriétaire”.
    return res.status(401).json({
      message: "Session expirée. Merci de vous reconnecter.",
    });
  }
}

function requireAuth(req, res, next) {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE];
  if (!token) {
    return res.status(401).json({ message: "Authentification requise." });
  }
  try {
    const payload = jwt.verify(token, readAccessSecret());
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({
      message: "Session expirée. Merci de vous reconnecter.",
    });
  }
}

function readRefreshToken(req) {
  return req.cookies?.[REFRESH_TOKEN_COOKIE] || null;
}

module.exports = {
  optionalAuth,
  requireAuth,
  readRefreshToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
};
