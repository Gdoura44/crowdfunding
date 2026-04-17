const { z } = require("zod");

const updateProfileSchema = z.object({
  firstName: z.string().trim().max(100).optional().default(""),
  lastName: z.string().trim().max(100).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  riskPreference: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  preferredCategories: z.array(z.string().trim().max(100)).optional().default([]),
});

module.exports = { updateProfileSchema };

