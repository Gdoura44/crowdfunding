const mongoose = require("mongoose");

const investmentSchema = new mongoose.Schema(
  {
    investorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    amount: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: [
        "INITIATED",
        "CANCELLING",
        "CANCELLED",
        "SUCCESS",
        "FAILED",
        "REFUNDED",
      ],
      default: "INITIATED",
      index: true,
    },
    paymentAttempts: { type: Number, default: 0, min: 0 },
    cancelReason: {
      type: String,
      enum: [
        "USER_REQUESTED",
        "PROJECT_DEACTIVATED",
        "PAYMENT_TIMEOUT",
        "FRAUDULENT",
        "USER_DEACTIVATED",
        "ACCOUNT_DELETION",
      ],
    },
    cancelledAt: { type: Date },
    cancellingStartedAt: { type: Date },
    scheduledForDeactivation: { type: Boolean, default: false },
    cancellationGracePeriodMinutes: { type: Number, default: 5, min: 1 },
  },
  { timestamps: true, collection: "investments" }
);

investmentSchema.index({ investorId: 1, status: 1 });
investmentSchema.index({ projectId: 1 });
investmentSchema.index({ status: 1, updatedAt: 1 });
investmentSchema.index({ status: 1, cancellingStartedAt: 1 });
investmentSchema.index({ scheduledForDeactivation: 1, updatedAt: 1 });

investmentSchema.pre("validate", function () {
  if (this.status === "CANCELLING" && !this.cancellingStartedAt) {
    this.cancellingStartedAt = new Date();
  }
  if (this.status !== "CANCELLING") {
    this.cancellingStartedAt = undefined;
  }
});

module.exports = mongoose.model("Investment", investmentSchema);
