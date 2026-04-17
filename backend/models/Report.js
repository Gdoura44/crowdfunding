const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["FRAUD", "INAPPROPRIATE_CONTENT", "SPAM", "OTHER"],
    },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["PENDING", "RESOLVED", "DISMISSED"],
      default: "PENDING",
    },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolution: { type: String, default: "" },
    resolvedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "reports" }
);

reportSchema.index({ reporterId: 1 });
reportSchema.index({ projectId: 1 });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reporterId: 1, projectId: 1, type: 1 });

module.exports = mongoose.model("Report", reportSchema);
