const { z } = require("zod");

function passwordRulesMessage() {
  return "Le mot de passe doit contenir au moins 8 caractères, avec au moins 1 lettre et 1 chiffre.";
}

function isStrongEnoughPassword(pw) {
  const s = String(pw || "");
  if (s.length < 8) return false;
  const hasLetter = /[A-Za-zÀ-ÿ]/.test(s);
  const hasDigit = /\d/.test(s);
  return hasLetter && hasDigit;
}

const registerSchema = z.object({
  email: z.string().trim().email("Veuillez saisir une adresse e-mail valide."),
  password: z
    .string()
    .min(8, passwordRulesMessage())
    .refine(isStrongEnoughPassword, passwordRulesMessage()),
  confirmPassword: z
    .string()
    .min(8, "Veuillez confirmer le mot de passe.")
    .refine(isStrongEnoughPassword, passwordRulesMessage()),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(40).optional(),
}).superRefine((val, ctx) => {
  if (val.password !== val.confirmPassword) {
    ctx.addIssue({
      code: "custom",
      message: "Les mots de passe ne correspondent pas.",
      path: ["confirmPassword"],
    });
  }
});

const loginSchema = z.object({
  email: z.string().trim().email("Veuillez saisir une adresse e-mail valide."),
  password: z.string().min(1, "Veuillez saisir votre mot de passe."),
  device: z.string().trim().max(200).optional(),
});

const verifyEmailSchema = z.object({
  token: z.string().min(10),
});

const verifyEmailCodeSchema = z.object({
  email: z.string().trim().email("Veuillez saisir une adresse e-mail valide."),
  code: z
    .string()
    .trim()
    .regex(/^\d{4,6}$/, "Veuillez saisir un code à 4 ou 6 chiffres."),
});

const resendVerificationSchema = z.object({
  email: z.string().trim().email("Veuillez saisir une adresse e-mail valide."),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Veuillez saisir une adresse e-mail valide."),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z
    .string()
    .min(8, passwordRulesMessage())
    .refine(isStrongEnoughPassword, passwordRulesMessage()),
});

module.exports = {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  verifyEmailCodeSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
