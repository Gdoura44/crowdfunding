const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
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
    type: {
      type: String,
      enum: ["INVESTMENT", "PAYOUT"],
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    amount: { type: Number, required: true }, // base amount
    fee: { type: Number, default: 0 },       // platform fee (if any)
    tax: { type: Number, default: 0 },       // e.g. VAT / TVA
    total: { type: Number, required: true },  // amount + fee + tax
    status: {
      type: String,
      enum: ["PENDING", "PAID", "REFUNDED", "CANCELLED"],
      default: "PAID",
    },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: "invoices" }
);

// Helper function to generate unique sequential invoice numbers
invoiceSchema.statics.generateInvoiceNumber = async function (type) {
  const prefix = type === "INVESTMENT" ? "INV-EST" : "INV-PAY";
  const year = new Date().getFullYear();
  const count = await this.countDocuments({
    invoiceNumber: new RegExp(`^${prefix}-${year}-`),
  });
  const sequence = String(count + 1).padStart(5, "0");
  return `${prefix}-${year}-${sequence}`;
};

module.exports = mongoose.model("Invoice", invoiceSchema);
