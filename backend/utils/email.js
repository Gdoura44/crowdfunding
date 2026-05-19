const nodemailer = require("nodemailer");

let transporter;

async function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (host) {
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
    return transporter;
  }

  // Secours en dev : auto-créer un compte SMTP de test pour que les emails soient quand même “envoyés”
  // et permettre d’ouvrir l’URL de prévisualisation dans la console (pratique pour démo/jury).
  if (process.env.NODE_ENV !== "production") {
    try {
      const acc = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: acc.smtp.host,
        port: acc.smtp.port,
        secure: acc.smtp.secure,
        auth: { user: acc.user, pass: acc.pass },
      });
      return transporter;
    } catch (err) {
      console.warn("[email] Impossible de créer le compte Ethereal de secours (hors ligne ?):", err.message);
      return null;
    }
  }

  return null;
}

// Pré-chargement asynchrone au démarrage du serveur pour éviter tout délai / timeout au premier envoi
void getTransporter().catch(() => {});

async function sendMail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || "noreply@localhost";
  const tx = await getTransporter();
  if (!tx) {
    console.info("[email] SMTP non configuré; envoi ignoré:", { to, subject });
    return false;
  }
  try {
    const info = await tx.sendMail({ from, to, subject, text, html });
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) {
      console.info("[email] URL de prévisualisation:", preview);
    }
    return true;
  } catch (err) {
    console.error("[email] Erreur lors de l'envoi de l'email:", err.message);
    return false;
  }
}

async function sendMailDetailed({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || "noreply@localhost";
  const tx = await getTransporter();
  if (!tx) {
    console.info("[email] SMTP non configuré; envoi ignoré:", { to, subject });
    return { ok: false, previewUrl: null, skipped: true };
  }
  try {
    const info = await tx.sendMail({ from, to, subject, text, html });
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    if (previewUrl) {
      console.info("[email] URL de prévisualisation:", previewUrl);
    }
    return { ok: true, previewUrl };
  } catch (err) {
    console.error("[email] Erreur lors de l'envoi de l'email détaillé:", err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { sendMail, sendMailDetailed };
