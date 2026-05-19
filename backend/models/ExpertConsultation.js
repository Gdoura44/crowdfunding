const mongoose = require("mongoose");

/**
 * ExpertConsultation : demande de consultation qu'un investisseur envoie à l'expert
 * lorsqu'il a investi >= 25 % de l'objectif de financement d'un projet.
 *
 * Cycle de vie simplifié :
 *   OPEN (nouvelle demande) → IN_PROGRESS (expert a répondu) → CLOSED (clôturée)
 */
const messageSchema = new mongoose.Schema(
  {
    senderRole: { type: String, enum: ["INVESTOR", "EXPERT"], required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const expertConsultationSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    investorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    expertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    investmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Investment",
      required: true,
    },
    /** Montant investi (snapshot au moment de la demande, pour vérification rapide). */
    investedAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["OPEN", "IN_PROGRESS", "CLOSED"],
      default: "OPEN",
    },
    subject: { type: String, default: "", trim: true },
    messages: { type: [messageSchema], default: [] },
    closedAt: { type: Date },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "expertconsultations" }
);

expertConsultationSchema.index({ investorId: 1, status: 1 });
expertConsultationSchema.index({ expertId: 1, status: 1 });
expertConsultationSchema.index({ projectId: 1 });
expertConsultationSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("ExpertConsultation", expertConsultationSchema);
