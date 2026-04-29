const mongoose = require("mongoose");

const aiAnalysisSchema = new mongoose.Schema(
  {
    riskScore: { type: Number },
    riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH"] },
    successProbability: { type: Number },
    analyzedAt: { type: Date },
    // Rapport lisible (stocké pour transparence vis-à-vis du créateur et de l’admin).
    report: {
      summary: { type: String, default: "" },
      advantages: [{ type: String }],
      disadvantages: [{ type: String }],
      improvements: [{ type: String }],
      removals: [{ type: String }],
      questionsToClarify: [{ type: String }],
    },
    // Sources éventuellement utilisées par l’analyse (URLs).
    sourcesUsed: [
      {
        url: { type: String },
        title: { type: String },
        domain: { type: String },
      },
    ],
    // Traçabilité (modèle utilisé + méthode d’analyse).
    meta: {
      method: { type: String, default: "" }, // ex. "web+llm" | "llm-only"
      model: { type: String, default: "" },
    },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: { type: String, default: "", trim: true },
    fundingGoal: { type: Number, required: true, min: 1 },
    currentFunding: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: [
        "DRAFT",
        "AWAITING_AI",
        "UNDER_REVIEW",
        "APPROVED",
        "ACTIVE",
        "REJECTED",
        "FUNDED",
        "CLOSED",
        "SUSPENDED",
      ],
      default: "DRAFT",
    },
    aiStatus: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "PENDING",
    },
    // Visibilité du workflow IA (BullMQ/n8n) : aide les créateurs/admins à comprendre l’état d’avancement.
    aiJobId: { type: String, default: "" },
    aiQueuedAt: { type: Date },
    aiNextRetryAt: { type: Date },
    aiLastError: { type: String, default: "" },
    aiAutoRetryCount: { type: Number, default: 0, min: 0 },
    aiAnalysisRetries: { type: Number, default: 0, min: 0, max: 3 },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startAt: { type: Date, required: true },
    deadline: { type: Date, required: true },
    rejectionReason: { type: String, default: "" },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectedAt: { type: Date },
    isArchived: { type: Boolean, default: false },
    isCreatorDeleted: { type: Boolean, default: false },
    fundedAt: { type: Date },
    publishedAt: { type: Date },
    images: [{ type: String }],
    documents: [{ type: String }],
    aiAnalysis: { type: aiAnalysisSchema, default: undefined },
  },
  { timestamps: true, collection: "projects" }
);

projectSchema.index({ status: 1, deadline: 1 });
projectSchema.index({ creatorId: 1 });
projectSchema.index({ status: 1, startAt: 1 });
projectSchema.index({ status: 1, isArchived: 1 });
projectSchema.index({ "aiAnalysis.analyzedAt": 1 });
projectSchema.index({ title: "text", description: "text" });

module.exports = mongoose.model("Project", projectSchema);
