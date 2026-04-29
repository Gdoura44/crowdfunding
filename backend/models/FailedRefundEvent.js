const mongoose = require("mongoose");

const failedRefundEventSchema = new mongoose.Schema(
  {
    investmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Investment",
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    error: { type: String, required: true },
    retryCount: { type: Number, default: 0 },
    reason: {
      type: String,
      required: true,
      enum: [
        "OVERFUNDING",
        "EXPIRY",
        "USER_REQUESTED",
        "USER_DEACTIVATED",
        "ACCOUNT_DELETION",
        "PROJECT_DEACTIVATED",
      ],
    },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "failedRefundEvents" }
);

failedRefundEventSchema.index({ investmentId: 1 });
failedRefundEventSchema.index({ resolved: 1, createdAt: -1 });
failedRefundEventSchema.index({ projectId: 1, reason: 1, resolved: 1 });

module.exports = mongoose.model("FailedRefundEvent", failedRefundEventSchema);
