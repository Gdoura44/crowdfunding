const jwt = require("jsonwebtoken");
const {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} = require("../config/constants");

function readAccessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is required");
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
  } catch {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE];
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }
  try {
    const payload = jwt.verify(token, readAccessSecret());
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired session" });
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
