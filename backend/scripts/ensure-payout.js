require("dotenv").config();
require("../models");

const mongoose = require("mongoose");
const payoutService = require("../services/payoutService");

async function main() {
  const projectId = String(process.argv[2] || "").trim();
  if (!projectId) {
    console.error("Usage: node scripts/ensure-payout.js <projectId>");
    process.exit(1);
  }

  await mongoose.connect(process.env.DATABASE);
  const res = await payoutService.ensurePayoutForFundedProject(projectId);
  await mongoose.disconnect();
  console.log(JSON.stringify({ ok: true, projectId, result: res }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

