require("dotenv").config();
const mongoose = require("mongoose");
require("../models");

const User = require("../models/User");
const Project = require("../models/Project");
const Investment = require("../models/Investment");
const Transaction = require("../models/Transaction");
const investmentService = require("../services/investmentService");

async function main() {
  console.log("=================================================");
  console.log("RUNNING INTEGRATION TEST FOR FINAL COMPLEMENT FUNDING");
  console.log("=================================================");

  const dbUri = process.env.DATABASE || "mongodb://127.0.0.1:27017/crowdfunding";
  console.log("Connecting to Database:", dbUri);
  await mongoose.connect(dbUri);

  // 1. Clean up old test data
  console.log("Cleaning up old test data...");
  const users = await User.find({ email: { $regex: /(@test\.com|@example\.com)$/i } });
  const userIds = users.map(u => u._id);
  await User.deleteMany({ email: { $regex: /(@test\.com|@example\.com)$/i } });
  
  if (userIds.length > 0) {
    const projects = await Project.find({ creatorId: { $in: userIds } });
    const projectIds = projects.map(p => p._id);
    const investments = await Investment.find({ projectId: { $in: projectIds } });
    const investmentIds = investments.map(i => i._id);
    
    await Project.deleteMany({ creatorId: { $in: userIds } });
    await Investment.deleteMany({ projectId: { $in: projectIds } });
    await Transaction.deleteMany({ investmentId: { $in: investmentIds } });
  }

  // 2. Create users
  console.log("Creating test users...");
  const creator = await User.create({
    email: "test.creator@test.com",
    passwordHash: "dummyhash",
    role: "USER",
    isEmailVerified: true,
    isActive: true,
    profile: { firstName: "Test", lastName: "Creator" }
  });

  const investor = await User.create({
    email: "test.investor@test.com",
    passwordHash: "dummyhash",
    role: "USER",
    isEmailVerified: true,
    isActive: true,
    profile: { firstName: "Test", lastName: "Investor" }
  });

  // 3. Create active project
  console.log("Creating project with 1000 realBudget and 1053 fundingGoal...");
  const project = await Project.create({
    creatorId: creator._id,
    title: "Project Final Complement Test",
    description: "Test description for final complement.",
    category: "Autre",
    realBudget: 1000,
    fundingGoal: 1053,
    currentFunding: 0,
    status: "ACTIVE",
    startAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // in 30 days
  });

  // 4. First investment: 1000 TND (leaving 53 TND)
  console.log("Creating first investment of 1000 TND...");
  const firstInv = await investmentService.createInvestment({
    investorId: investor._id,
    projectId: project._id,
    amount: 1000,
    wantsConsultation: false,
  });

  console.log("Confirming first investment payment...");
  await investmentService.confirmMockPaymentFromClient({
    providerPaymentId: firstInv.providerPaymentId,
    status: "SUCCEEDED",
    paymentMethod: "CARD",
  });

  const pAfterFirst = await Project.findById(project._id);
  console.log(`Project funding: ${pAfterFirst.currentFunding} / ${pAfterFirst.fundingGoal} TND, Status: ${pAfterFirst.status}`);
  if (pAfterFirst.currentFunding !== 1000) {
    throw new Error(`Expected currentFunding to be 1000, got ${pAfterFirst.currentFunding}`);
  }
  if (pAfterFirst.status !== "ACTIVE") {
    throw new Error(`Expected status to be ACTIVE, got ${pAfterFirst.status}`);
  }

  // 5. Try to invest 50 TND (invalid complement, remaining is 53 TND)
  console.log("Attempting invalid complement investment of 50 TND (should throw)...");
  try {
    await investmentService.createInvestment({
      investorId: investor._id,
      projectId: project._id,
      amount: 50,
      wantsConsultation: false,
    });
    throw new Error("Invalid complement amount did not throw an error!");
  } catch (err) {
    console.log("=> Success: Rejected invalid complement (thrown error:", err.message, ")");
  }

  // 6. Invest exactly 53 TND (valid complement, under 100 TND)
  console.log("Creating exact complement investment of 53 TND...");
  const secondInv = await investmentService.createInvestment({
    investorId: investor._id,
    projectId: project._id,
    amount: 53,
    wantsConsultation: false,
  });

  console.log("Confirming complement investment payment...");
  await investmentService.confirmMockPaymentFromClient({
    providerPaymentId: secondInv.providerPaymentId,
    status: "SUCCEEDED",
    paymentMethod: "CARD",
  });

  const pAfterSecond = await Project.findById(project._id);
  console.log(`Project funding: ${pAfterSecond.currentFunding} / ${pAfterSecond.fundingGoal} TND, Status: ${pAfterSecond.status}`);
  if (pAfterSecond.currentFunding !== 1053) {
    throw new Error(`Expected currentFunding to be 1053, got ${pAfterSecond.currentFunding}`);
  }
  if (pAfterSecond.status !== "FUNDED") {
    throw new Error(`Expected status to be FUNDED, got ${pAfterSecond.status}`);
  }

  console.log("=========================================");
  console.log("🎉 SUCCESS: FINAL COMPLEMENT FUNDING TEST PASSED");
  console.log("=========================================");
  
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
