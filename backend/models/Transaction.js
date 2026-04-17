const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    investmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Investment",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["FLOUCI", "KONNECT", "D17"],
      default: "FLOUCI",
    },
    providerPaymentId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["PENDING", "SUCCEEDED", "FAILED", "REFUNDED", "CANCELLED"],
      default: "PENDING",
    },
    cancelledAt: { type: Date },
    paymentMethod: { type: String, default: "" },
    attemptNumber: { type: Number, default: 1, min: 1 },
    refundStatus: {
      type: String,
      enum: ["NOT_ATTEMPTED", "PENDING", "SUCCEEDED", "FAILED"],
      default: "NOT_ATTEMPTED",
    },
    refundAttempts: { type: Number, default: 0, min: 0 },
    lastRefundAttemptAt: { type: Date },
    refundedAt: { type: Date },
  },
  { timestamps: true, collection: "transactions" }
);

transactionSchema.index(
  { provider: 1, providerPaymentId: 1 },
  { unique: true }
);
transactionSchema.index({ investmentId: 1, attemptNumber: 1 }, { unique: true });
transactionSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);
