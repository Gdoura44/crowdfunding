const { z } = require("zod");
const { FUNDING_GOAL_MIN, FUNDING_GOAL_MAX } = require("../config/businessRules");

const createDraftSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().max(20000).optional().default(""),
  category: z.string().trim().max(100).optional().default(""),
  fundingGoal: z.coerce.number().int().min(FUNDING_GOAL_MIN).max(FUNDING_GOAL_MAX),
  startAt: z.coerce.date(),
  deadline: z.coerce.date(),
});

const updateProjectSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().max(20000).optional(),
    category: z.string().trim().max(100).optional(),
    fundingGoal: z.coerce.number().int().min(FUNDING_GOAL_MIN).max(FUNDING_GOAL_MAX).optional(),
    startAt: z.coerce.date().optional(),
    deadline: z.coerce.date().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No changes provided" });

module.exports = { createDraftSchema, updateProjectSchema };
