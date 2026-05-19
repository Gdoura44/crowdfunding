const mongoose = require("mongoose");
require("dotenv").config();
const Project = require("../models/Project");
const cronService = require("../services/cronService");

async function run() {
  await mongoose.connect(process.env.DATABASE);
  console.log("Connected to database.");
  
  // Reset retry thresholds for stuck projects to ensure they are picked up immediately
  const updateRes = await Project.updateMany(
    { status: "AWAITING_AI" },
    { 
      $set: { 
        aiNextRetryAt: null,
        aiQueuedAt: new Date(0) // 1970 - guarantees it is matched as "older than cutoff"
      } 
    }
  );
  console.log(`Reset retry limits for ${updateRes.modifiedCount} stuck projects.`);

  console.log("Running self-healing stuck AI retry cron...");
  const res = await cronService.retryStuckAiAnalyses({
    olderThanMinutes: 0,
    limit: 50,
  });
  
  console.log("Cron run finished. Result:", res);
  await mongoose.disconnect();
}

run();
