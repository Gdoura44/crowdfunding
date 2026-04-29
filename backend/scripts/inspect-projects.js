require("dotenv").config();

const mongoose = require("mongoose");
const Project = require("../models/Project");

async function main() {
  await mongoose.connect(process.env.DATABASE);

  const list = await Project.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .select("title status aiStatus aiQueuedAt aiJobId aiLastError aiAnalysisRetries isArchived startAt deadline publishedAt")
    .lean();

  console.log("Projets récents:");
  for (const p of list) {
    console.log(
      String(p._id),
      "|",
      String(p.title || ""),
      "|",
      p.status,
      "| ai",
      String(p.aiStatus || ""),
      "| queuedAt",
      p.aiQueuedAt || null,
      "| retries",
      Number(p.aiAnalysisRetries || 0),
      "| archived",
      Boolean(p.isArchived),
      "| startAt",
      p.startAt,
      "| publishedAt",
      p.publishedAt
    );
    if (p.aiLastError) console.log("  aiLastError:", String(p.aiLastError).slice(0, 200));
  }

  const agg = await Project.aggregate([
    { $group: { _id: { status: "$status", archived: "$isArchived" }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);
  console.log("Comptes:", agg);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

