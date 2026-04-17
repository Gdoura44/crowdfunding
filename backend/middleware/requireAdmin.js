const HttpError = require("../utils/HttpError");

function requireAdmin(req, _res, next) {
  if (!req.user) {
    return next(new HttpError(401, "Authentication required"));
  }
  if (req.user.role !== "ADMIN") {
    return next(new HttpError(403, "Admin access required"));
  }
  return next();
}

module.exports = { requireAdmin };

