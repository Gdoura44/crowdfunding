require("dotenv").config();
require("./models");
const mongoose = require("mongoose");
const app = require("./app");
const cronService = require("./services/cronService");
const {
  INTERNAL_CRON_DEFAULT_INTERVAL_MIN,
  INTERNAL_CRON_RETRY_STUCK_AI_OLDER_THAN_MIN,
} = require("./config/constants");

const port = process.env.PORT || 5000;
const databaseUrl = process.env.DATABASE;

if (!databaseUrl) {
  console.error("La variable d’environnement DATABASE est requise");
  process.exit(1);
}

if (!process.env.JWT_ACCESS_SECRET) {
  console.error("La variable d’environnement JWT_ACCESS_SECRET est requise");
  process.exit(1);
}

if (!process.env.INTERNAL_API_SECRET) {
  console.warn(
    "[config] INTERNAL_API_SECRET non défini : /internal/* (n8n, cron) renverra 503 tant que ce n’est pas configuré."
  );
}

mongoose
  .connect(databaseUrl)
  .then(() => {
    console.log("Base de données connectée");
    app.listen(port, () => {
      console.log(`Serveur démarré sur le port ${port}`);
    });

    // Planificateur interne optionnel.
    // Pourquoi: si le quota Gemini est épuisé, les retries n8n peuvent s’arrêter ;
    // ce scheduler interne relance les analyses IA dès que le quota redevient disponible,
    // sans intervention manuelle.
    const enableInternalCron =
      String(process.env.INTERNAL_CRON_ENABLED || "").trim().toLowerCase() === "true";
    if (enableInternalCron) {
      const intervalMin = Math.max(
        Number(process.env.INTERNAL_CRON_INTERVAL_MIN || INTERNAL_CRON_DEFAULT_INTERVAL_MIN),
        1
      );
      const run = async () => {
        try {
          await cronService.retryStuckAiAnalyses({
            olderThanMinutes: INTERNAL_CRON_RETRY_STUCK_AI_OLDER_THAN_MIN,
            limit: 20,
          });
        } catch (e) {
          // best-effort
          console.warn("[internal-cron] retry-stuck-ai a échoué:", e?.message || e);
        }
      };
      // Kick once at startup, then repeat.
      void run();
      setInterval(run, intervalMin * 60 * 1000);
      console.log(`[internal-cron] activé : retry-stuck-ai toutes les ${intervalMin} min`);
    }
  })
  .catch((err) => {
    console.error("Impossible de se connecter à la base de données", err);
    process.exit(1);
  });
