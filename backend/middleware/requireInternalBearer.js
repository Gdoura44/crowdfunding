const crypto = require("crypto");

function timingSafeStringEqual(a, b) {
  try {
    const ba = Buffer.from(String(a), "utf8");
    const bb = Buffer.from(String(b), "utf8");
    if (ba.length !== bb.length) {
      return false;
    }
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * n8n / cron call internal routes with `Authorization: Bearer <INTERNAL_API_SECRET>`
 * (architecture_system + system sequence diagram n8n).
 */
function requireInternalBearer(req, res, next) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return res.status(503).json({
      message:
        "Configuration manquante : INTERNAL_API_SECRET est requis pour les routes internes (/internal/*).",
    });
  }
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match ? match[1].trim() : "";
  if (!token || !timingSafeStringEqual(token, secret)) {
    return res.status(401).json({ message: "Accès non autorisé (jeton interne invalide)." });
  }
  next();
}

module.exports = requireInternalBearer;
