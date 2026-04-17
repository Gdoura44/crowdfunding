const mongoose = require("mongoose");

const failedWorkflowEventSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    workflowType: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    error: { type: String, required: true },
    retryCount: { type: Number, default: 0 },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "failedWorkflowEvents" }
);

failedWorkflowEventSchema.index({ resolved: 1, createdAt: -1 });
failedWorkflowEventSchema.index({ projectId: 1 }, { sparse: true });
failedWorkflowEventSchema.index({ workflowType: 1, resolved: 1 });

module.exports = mongoose.model("FailedWorkflowEvent", failedWorkflowEventSchema);
