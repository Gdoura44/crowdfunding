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

  // Dev fallback: auto-create a test SMTP account so emails are still "sent"
  // and you can open the preview URL in the console (jury/demo friendly).
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
    console.info("[email] SMTP not configured; skipping send:", { to, subject });
    return false;
  }
  const info = await tx.sendMail({ from, to, subject, text, html });
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) {
    console.info("[email] Preview URL:", preview);
  }
  return true;
}

module.exports = { sendMail };
