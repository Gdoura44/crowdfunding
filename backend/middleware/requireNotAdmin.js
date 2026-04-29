const HttpError = require("../utils/HttpError");

/**
 * Pourquoi: règle métier — les admins gèrent la plateforme, ils ne doivent pas agir comme créateurs.
 * On l’impose côté API pour éviter qu’un appel HTTP direct contourne l’UI.
 */
function requireNotAdmin(req, _res, next) {
  if (!req.user) {
    return next(new HttpError(401, "Authentification requise."));
  }
  if (req.user.role === "ADMIN") {
    return next(
      new HttpError(
        403,
        "Action réservée aux créateurs. Un administrateur ne peut pas effectuer cette action."
      )
    );
  }
  return next();
}

module.exports = { requireNotAdmin };

