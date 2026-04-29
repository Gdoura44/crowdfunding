require("dotenv").config();
require("../models");

const mongoose = require("mongoose");
const Project = require("../models/Project");

async function main() {
  const projectId = String(process.argv[2] || "").trim();
  if (!projectId) {
    console.error("Usage: node scripts/set-project-startat-yesterday.js <projectId>");
    process.exit(1);
  }

  const y = new Date();
  y.setDate(y.getDate() - 1);
  y.setHours(0, 0, 0, 0);

  await mongoose.connect(process.env.DATABASE);
  const res = await Project.updateOne({ _id: projectId }, { $set: { startAt: y } });
  await mongoose.disconnect();
  console.log(JSON.stringify({ ok: true, projectId, startAt: y.toISOString(), modified: res.modifiedCount || 0 }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

