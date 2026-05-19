const { z } = require("zod");
const { PROJECT_CATEGORIES } = require("../config/categories");

const updateProfileSchema = z.object({
  firstName: z.string().trim().max(100).optional().default(""),
  lastName: z.string().trim().max(100).optional().default(""),
  cabinetName: z.string().trim().max(150).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  riskPreference: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  preferredCategories: z
    .array(z.string().trim().max(100))
    .optional()
    .default([])
    // Pour garder une UX fluide: ignorer les valeurs inconnues/legacy au lieu de bloquer la sauvegarde du profil.
    .transform((arr) => arr.filter((c) => PROJECT_CATEGORIES.includes(c))),
});

module.exports = { updateProfileSchema };

