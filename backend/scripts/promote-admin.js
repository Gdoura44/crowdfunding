require("dotenv").config();
require("../models");

const mongoose = require("mongoose");
const User = require("../models/User");

async function main() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  if (!email) {
    console.error("Usage: node scripts/promote-admin.js <email>");
    process.exit(1);
  }

  await mongoose.connect(process.env.DATABASE);
  const res = await User.updateOne({ email }, { $set: { role: "ADMIN" } });
  await mongoose.disconnect();
  console.log(JSON.stringify({ ok: true, email, modified: res.modifiedCount || 0 }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

