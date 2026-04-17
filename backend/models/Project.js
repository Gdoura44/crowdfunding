const mongoose = require("mongoose");

const aiAnalysisSchema = new mongoose.Schema(
  {
    riskScore: { type: Number },
    riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH"] },
    successProbability: { type: Number },
    analyzedAt: { type: Date },
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
    // Workflow visibility (BullMQ/n8n). Helps creators/admins understand what happened.
    aiJobId: { type: String, default: "" },
    aiQueuedAt: { type: Date },
    aiLastError: { type: String, default: "" },
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
