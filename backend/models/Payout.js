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
      enum: ["PENDING", "READY", "COMPLETED", "CANCELLED", "FAILED"],
      default: "PENDING",
    },
    bankDetails: { type: String, default: null },
    failureReason: { type: String, default: "" },
    notes: { type: String, default: "" },
    bankDetailsProvidedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "payouts" }
);

payoutSchema.index({ projectId: 1 }, { unique: true });
payoutSchema.index({ creatorId: 1, status: 1 });
payoutSchema.index({ status: 1 });

module.exports = mongoose.model("Payout", payoutSchema);
