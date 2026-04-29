const HttpError = require("../utils/HttpError");

function requireAdmin(req, _res, next) {
  if (!req.user) {
    return next(new HttpError(401, "Authentification requise."));
  }
  if (req.user.role !== "ADMIN") {
    return next(new HttpError(403, "Accès administrateur requis."));
  }
  return next();
}

module.exports = { requireAdmin };

