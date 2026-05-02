const mongoose = require("mongoose");

const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    device: { type: String, default: "" },
  },
  { _id: false }
);

const userProfileSchema = new mongoose.Schema(
  {
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    // Téléphone : stocké au format E.164 quand possible (ex. "+21612345678")
    phone: { type: String, default: "" },
    // Remarque : le pays n’est pas persisté ; l’UI stocke le E.164 complet dans `phone`.
    riskPreference: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "MEDIUM",
    },
    preferredCategories: [{ type: String }],
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      required: true,
      default: "USER",
    },
    isActive: { type: Boolean, default: false },
    // Vérification e-mail : code OTP (principal) + lien (secours).
    verifyCodeHash: { type: String, default: null },
    verifyCodeExpiry: { type: Date, default: null },
    verifyTokenHash: { type: String, default: null },
    verifyTokenExpiry: { type: Date, default: null },
    verifyTokenUsedAt: { type: Date, default: null },
    verifyTokenUsedBy: { type: String, enum: ["CODE", "LINK"], default: null },
    resetTokenHash: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    refreshTokens: { type: [refreshTokenSchema], default: [] },
    profile: { type: userProfileSchema, default: () => ({}) },
  },
  { timestamps: true, collection: "users" }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ isActive: 1 });
userSchema.index({ deletedAt: 1 });
// Les recherches de vérification doivent être rapides (utilisées sur des endpoints publics).
userSchema.index({ verifyTokenHash: 1 });
userSchema.index({ verifyCodeHash: 1 });

module.exports = mongoose.model("User", userSchema);
