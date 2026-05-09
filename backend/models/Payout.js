const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["PENDING", "READY", "PROCESSING", "COMPLETED", "CANCELLED", "FAILED"],
      default: "PENDING",
    },
    provider: { type: String, default: "" }, // ex: "FLOUCI" (simulation)
    providerTransferId: { type: String, default: "" },
    bankDetails: { type: String, default: null },
    failureReason: { type: String, default: "" },
    notes: { type: String, default: "" },
    bankDetailsProvidedAt: { type: Date },
    transferInitiatedAt: { type: Date },
    completedAt: { type: Date },
    failedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "payouts" }
);

payoutSchema.index({ projectId: 1 }, { unique: true });
payoutSchema.index({ creatorId: 1, status: 1 });
payoutSchema.index({ status: 1 });

module.exports = mongoose.model("Payout", payoutSchema);
