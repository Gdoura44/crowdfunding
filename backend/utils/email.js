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
    const acc = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: acc.smtp.host,
      port: acc.smtp.port,
      secure: acc.smtp.secure,
      auth: { user: acc.user, pass: acc.pass },
    });
    return transporter;
  }

  return null;
}

async function sendMail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || "noreply@localhost";
  const tx = await getTransporter();
  if (!tx) {
    console.info("[email] SMTP non configuré; envoi ignoré:", { to, subject });
    return false;
  }
  const info = await tx.sendMail({ from, to, subject, text, html });
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) {
    console.info("[email] URL de prévisualisation:", preview);
  }
  return true;
}

async function sendMailDetailed({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || "noreply@localhost";
  const tx = await getTransporter();
  if (!tx) {
    console.info("[email] SMTP non configuré; envoi ignoré:", { to, subject });
    return { ok: false, previewUrl: null, skipped: true };
  }
  const info = await tx.sendMail({ from, to, subject, text, html });
  const previewUrl = nodemailer.getTestMessageUrl(info) || null;
  if (previewUrl) {
    console.info("[email] URL de prévisualisation:", previewUrl);
  }
  return { ok: true, previewUrl };
}

module.exports = { sendMail, sendMailDetailed };
