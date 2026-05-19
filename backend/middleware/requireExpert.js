const HttpError = require("../utils/HttpError");

/**
 * Protège les routes réservées aux experts en analyse financière.
 * L'expert peut valider/rejeter l'analyse IA d'un projet mais NE PEUT PAS publier.
 * La publication reste une prérogative de l'administrateur.
 */
function requireExpert(req, _res, next) {
  if (!req.user) {
    return next(new HttpError(401, "Authentification requise."));
  }
  if (!["EXPERT", "ADMIN"].includes(req.user.role)) {
    return next(new HttpError(403, "Accès réservé aux experts en analyse financière."));
  }
  return next();
}

/**
 * Variante stricte : EXPERT uniquement (exclut les admins qui ont leur propre route).
 */
function requireExpertStrict(req, _res, next) {
  if (!req.user) {
    return next(new HttpError(401, "Authentification requise."));
  }
  if (req.user.role !== "EXPERT") {
    return next(new HttpError(403, "Accès réservé aux experts en analyse financière."));
  }
  return next();
}

module.exports = { requireExpert, requireExpertStrict };
