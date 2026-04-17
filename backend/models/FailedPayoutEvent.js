const mongoose = require("mongoose");

const failedPayoutEventSchema = new mongoose.Schema(
  {
    payoutId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payout",
      required: true,
    },
    error: { type: String, required: true },
    retryCount: { type: Number, default: 0 },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "failedPayoutEvents" }
);

failedPayoutEventSchema.index({ payoutId: 1 });
failedPayoutEventSchema.index({ resolved: 1, createdAt: -1 });

module.exports = mongoose.model("FailedPayoutEvent", failedPayoutEventSchema);
