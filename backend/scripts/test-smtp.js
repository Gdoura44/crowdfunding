require("dotenv").config();

const { sendMail } = require("../utils/email");

async function main() {
  const to = process.env.SMTP_TEST_TO || process.env.SMTP_USER;
  if (!to) {
    console.error("Variable manquante : SMTP_TEST_TO ou SMTP_USER dans `.env`");
    process.exit(1);
  }

  console.log("SMTP_HOST:", process.env.SMTP_HOST || "(non défini)");
  console.log("SMTP_PORT:", process.env.SMTP_PORT || "(non défini)");
  console.log("SMTP_SECURE:", process.env.SMTP_SECURE || "(non défini)");
  console.log("SMTP_USER:", process.env.SMTP_USER ? "(défini)" : "(non défini)");
  console.log("MAIL_FROM:", process.env.MAIL_FROM || "(non défini)");
  console.log("Destinataire:", to);

  try {
    const ok = await sendMail({
      to,
      subject: "FinCollab — test SMTP",
      text: "Ceci est un e-mail de test SMTP (FinCollab).",
      html: "<p>Ceci est un <strong>e-mail de test SMTP</strong> (FinCollab).</p>",
    });
    console.log("sendMail a renvoyé:", ok);
  } catch (e) {
    console.error("Envoi SMTP échoué:", e?.message || e);
    process.exit(1);
  }
}

main();

