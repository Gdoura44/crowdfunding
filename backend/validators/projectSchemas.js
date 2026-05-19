const { z } = require("zod");
const { FUNDING_GOAL_MIN, FUNDING_GOAL_MAX } = require("../config/businessRules");
const { MIN_PROJECT_DURATION_DAYS } = require("../config/constants");
const { PROJECT_CATEGORIES } = require("../config/categories");

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const createDraftSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().max(20000).optional().default(""),
  category: z.string().trim().min(1).max(100),
  realBudget: z.coerce.number().int().min(FUNDING_GOAL_MIN).max(FUNDING_GOAL_MAX).optional(),
  fundingGoal: z.coerce.number().int().min(FUNDING_GOAL_MIN).max(FUNDING_GOAL_MAX),
  startAt: z.coerce.date(),
  deadline: z.coerce.date(),
  isCompany: z.boolean().optional().default(false),
  companyName: z.string().trim().max(300).optional().default(""),
  companyMatricule: z.string().trim().max(100).optional().default(""),
  companyRNE: z.string().trim().max(100).optional().default(""),
}).superRefine((o, ctx) => {
  if (o.category && !PROJECT_CATEGORIES.includes(o.category)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["category"],
      message: "Catégorie invalide. Merci de choisir une catégorie de la liste.",
    });
  }
  const startAt = startOfDay(o.startAt);
  const deadline = startOfDay(o.deadline);
  const minDeadline = startOfDay(new Date(startAt));
  minDeadline.setDate(minDeadline.getDate() + MIN_PROJECT_DURATION_DAYS);
  if (deadline < minDeadline) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["deadline"],
      message: `La campagne doit durer au moins ${MIN_PROJECT_DURATION_DAYS} jours (≈ 1 mois) après le démarrage.`,
    });
  }
});

const updateProjectSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().max(20000).optional(),
    category: z.string().trim().max(100).optional(),
    realBudget: z.coerce.number().int().min(FUNDING_GOAL_MIN).max(FUNDING_GOAL_MAX).optional(),
    fundingGoal: z.coerce.number().int().min(FUNDING_GOAL_MIN).max(FUNDING_GOAL_MAX).optional(),
    startAt: z.coerce.date().optional(),
    deadline: z.coerce.date().optional(),
    isCompany: z.boolean().optional(),
    companyName: z.string().trim().max(300).optional(),
    companyMatricule: z.string().trim().max(100).optional(),
    companyRNE: z.string().trim().max(100).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No changes provided" });

module.exports = { createDraftSchema, updateProjectSchema };
