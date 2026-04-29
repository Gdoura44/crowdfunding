require("dotenv").config();
require("../models");

const mongoose = require("mongoose");
const Project = require("../models/Project");
const { ProjectStatus } = require("../config/projectLifecycle");

async function main() {
  const projectId = String(process.argv[2] || "").trim();
  if (!projectId) {
    console.error("Usage: node scripts/force-ai-complete.js <projectId>");
    process.exit(1);
  }

  await mongoose.connect(process.env.DATABASE);

  const now = new Date();
  const res = await Project.updateOne(
    { _id: projectId },
    {
      $set: {
        status: ProjectStatus.UNDER_REVIEW,
        aiStatus: "COMPLETED",
        aiQueuedAt: now,
        aiCompletedAt: now,
        aiLastError: null,
        aiNextRetryAt: null,
        aiAutoRetryCount: 0,
        aiAnalysis: {
          analyzedAt: now,
          successProbability: 72,
          riskLevel: "MEDIUM",
          report: {
            summary:
              "Analyse IA simulée (tests): le projet semble globalement cohérent mais nécessite une validation admin.",
            advantages: ["Description structurée", "Budget cohérent avec l’objectif"],
            disadvantages: ["Jalons peu détaillés"],
            improvements: [
              "Ajouter des jalons + livrables mesurables.",
              "Expliquer les risques principaux et votre plan d’atténuation.",
            ],
          },
          sourcesUsed: [],
          meta: { method: "tests-simulated", model: "none" },
        },
      },
    }
  );

  await mongoose.disconnect();
  console.log(JSON.stringify({ ok: true, projectId, modified: res.modifiedCount || 0 }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

