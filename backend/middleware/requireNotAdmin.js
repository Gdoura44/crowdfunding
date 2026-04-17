const HttpError = require("../utils/HttpError");

/**
 * WHY: Business rule — admins manage the platform, they should not act as creators.
 * We enforce it at the API layer so direct HTTP calls can't bypass the frontend UI.
 */
function requireNotAdmin(req, _res, next) {
  if (!req.user) {
    return next(new HttpError(401, "Authentication required"));
  }
  if (req.user.role === "ADMIN") {
    return next(new HttpError(403, "Admins cannot perform creator actions"));
  }
  return next();
}

module.exports = { requireNotAdmin };

