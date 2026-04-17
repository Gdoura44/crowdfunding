const { z } = require("zod");
const mongoose = require("mongoose");

const objectIdString = z
  .string()
  .refine((v) => mongoose.isValidObjectId(v), { message: "Invalid project id" });

const updateAiAnalysisSchema = z.object({
  projectId: objectIdString,
  riskScore: z.coerce.number().finite().nonnegative(),
  // Accept case-insensitive values from workflow tools.
  riskLevel: z.preprocess(
    (v) => String(v || "").toUpperCase(),
    z.enum(["LOW", "MEDIUM", "HIGH"])
  ),
  // WHY: Conception + UI treat successProbability as a percentage (0..100).
  // Accept percent to avoid workflow validation failures.
  successProbability: z.coerce.number().min(0).max(100).optional(),
  analyzedAt: z.coerce.date().optional(),
});

const markAiFailedSchema = z.object({
  projectId: objectIdString,
  error: z.string().min(1).max(5000),
});

const runRiskAnalysisSchema = z.object({
  projectId: objectIdString,
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(20000).optional(),
  category: z.string().max(100).optional(),
  fundingGoal: z.coerce.number().finite().nonnegative().optional(),
  deadline: z.coerce.date().optional(),
});

module.exports = { updateAiAnalysisSchema, markAiFailedSchema, runRiskAnalysisSchema };
