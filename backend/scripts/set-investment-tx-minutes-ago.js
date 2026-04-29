require("dotenv").config();
require("../models");

const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");

async function main() {
  const investmentId = String(process.argv[2] || "").trim();
  const minutes = Number(process.argv[3] || 10);
  if (!investmentId) {
    console.error("Usage: node scripts/set-investment-tx-minutes-ago.js <investmentId> [minutes]");
    process.exit(1);
  }
  const d = new Date(Date.now() - Math.max(0, minutes) * 60 * 1000);

  await mongoose.connect(process.env.DATABASE);
  const res = await Transaction.updateMany(
    { investmentId },
    { $set: { createdAt: d, updatedAt: d } }
  );
  await mongoose.disconnect();
  console.log(
    JSON.stringify({ ok: true, investmentId, createdAt: d.toISOString(), modified: res.modifiedCount || 0 })
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

