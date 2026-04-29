const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    authorLabel: { type: String, default: "", trim: true },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    isHidden: { type: Boolean, default: false, index: true },
    hiddenReason: { type: String, default: "", trim: true },
    hiddenAt: { type: Date },
    hiddenBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deletedByRole: { type: String, enum: ["USER", "ADMIN"], default: "USER" },
  },
  { timestamps: true, collection: "comments" }
);

commentSchema.index({ projectId: 1, createdAt: -1 });
commentSchema.index({ isHidden: 1, createdAt: -1 });
commentSchema.index({ deletedAt: 1, createdAt: -1 });

module.exports = mongoose.model("Comment", commentSchema);

