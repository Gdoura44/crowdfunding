const mongoose = require("mongoose");

const NOTIFICATION_TYPES = [
  "PROJECT_CREATED",
  "PROJECT_UPDATED",
  "PROJECT_SUBMITTED",
  "PROJECT_ARCHIVED",
  "PROJECT_DELETED",
  "PROJECT_APPROVED",
  "PROJECT_REJECTED",
  "PROJECT_AUTO_REJECTED",
  "PROJECT_PUBLISHED",
  "PROJECT_FUNDED",
  "PROJECT_WARNING",
  "PROJECT_FUNDING_GOAL_LOST",
  "NEW_INVESTMENT",
  "PAYMENT_SUCCESS",
  "PAYMENT_FAILED",
  "PAYMENT_CANCELLED",
  "PAYMENT_REFUNDED",
  "OVERFUND_REFUNDED",
  "PROJECT_EXPIRED",
  "REPORT_RESOLVED",
  "PAYOUT_COMPLETED",
  "PAYOUT_PROCESSING",
  "PAYOUT_BANK_DETAILS_REQUEST",
  "PAYOUT_READY_FOR_APPROVAL",
  "PAYOUT_CANCELLED",
  "PROJECT_REACTIVATED",
  "PROJECT_SUSPENDED",
  "CANCELLATION_FAILED",
  "REFUND_FAILED",
  "ACCOUNT_DELETED",
  "NEW_REPORT",
  "USER_DEACTIVATED",
  "PAYOUT_FAILED",
  "USER_REACTIVATED",
  "PASSWORD_RESET_REQUESTED",
  "PROJECT_AI_REPORT_READY",
  "PAYMENT_HELD_CONSULTATION",
  "NEW_ASSIGNMENT",
  "EXPERT_REPORT_READY",
  "EXPERT_STATUS_CHANGED",
  "NEW_EXPERT_APPLICATION",
  "NEW_PROJECT_SUBMITTED",
  "NEW_REPORT_SUBMITTED",
  "INVESTMENT_RECEIVED",
  "NEW_MESSAGE",
];

const RELATED_ENTITY_TYPES = ["PROJECT", "INVESTMENT", "REPORT", "PAYOUT", "USER"];

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: { type: String, required: true, enum: NOTIFICATION_TYPES },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    // Tri admin: distinct du flag `read` du destinataire (utilisé pour la file admin).
    adminRead: { type: Boolean, default: false },
    relatedEntityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    relatedEntityType: {
      type: String,
      enum: [...RELATED_ENTITY_TYPES, null],
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "notifications" }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ read: 1 });
notificationSchema.index({ adminRead: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
