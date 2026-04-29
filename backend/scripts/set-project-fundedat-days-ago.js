require("dotenv").config();
require("../models");

const mongoose = require("mongoose");
const Project = require("../models/Project");

async function main() {
  const projectId = String(process.argv[2] || "").trim();
  const days = Number(process.argv[3] || 2);
  if (!projectId) {
    console.error("Usage: node scripts/set-project-fundedat-days-ago.js <projectId> [days]");
    process.exit(1);
  }
  const d = new Date(Date.now() - Math.max(0, days) * 24 * 60 * 60 * 1000);

  await mongoose.connect(process.env.DATABASE);
  const res = await Project.updateOne(
    { _id: projectId },
    { $set: { fundedAt: d } }
  );
  await mongoose.disconnect();
  console.log(JSON.stringify({ ok: true, projectId, fundedAt: d.toISOString(), modified: res.modifiedCount || 0 }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

