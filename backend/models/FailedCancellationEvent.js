const mongoose = require("mongoose");

const failedCancellationEventSchema = new mongoose.Schema(
  {
    investmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Investment",
      required: true,
    },
    error: { type: String, required: true },
    retryCount: { type: Number, default: 0 },
    reason: {
      type: String,
      required: true,
      enum: [
        "CANCELLATION_FAILED",
        "POST_UPDATE_FAILED",
        "STUCK_CANCELLING",
        "PROJECT_DEACTIVATED",
      ],
    },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "failedCancellationEvents" }
);

failedCancellationEventSchema.index({ investmentId: 1 });
failedCancellationEventSchema.index({ resolved: 1, createdAt: -1 });

module.exports = mongoose.model(
  "FailedCancellationEvent",
  failedCancellationEventSchema
);
