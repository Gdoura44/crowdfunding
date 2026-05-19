const mongoose = require("mongoose");
require("dotenv").config();
const Project = require("../models/Project");

async function check() {
  await mongoose.connect(process.env.DATABASE);
  const projects = await Project.find({ status: "AWAITING_AI" }).lean();
  console.log("=== Stuck Projects ===");
  console.log(JSON.stringify(projects, null, 2));
  await mongoose.disconnect();
}

check();
