require("dotenv").config();
const mongoose = require("mongoose");
require("../models");

const User = require("../models/User");
const Project = require("../models/Project");
const Investment = require("../models/Investment");
const Payout = require("../models/Payout");
const Invoice = require("../models/Invoice");
const Transaction = require("../models/Transaction");
const payoutService = require("../services/payoutService");

async function main() {
  console.log("=================================================");
  console.log("RUNNING DIRECT SERVICES LIFE-CYCLE TEST FOR PAYOUT COMMISSION");
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
    await Payout.deleteMany({ projectId: { $in: projectIds } });
    await Invoice.deleteMany({ projectId: { $in: projectIds } });
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

  const admin = await User.create({
    email: "test.admin@test.com",
    passwordHash: "dummyhash",
    role: "ADMIN",
    isEmailVerified: true,
    isActive: true,
    profile: { firstName: "Test", lastName: "Admin" }
  });

  // 3. Create active project
  console.log("Creating project with 20000 realBudget and 21053 fundingGoal...");
  const project = await Project.create({
    title: "Eco Power Solar Panels",
    description: "Installing solar panels in community centers.",
    category: "Autre",
    realBudget: 20000,
    fundingGoal: 21053,
    status: "ACTIVE",
    aiStatus: "COMPLETED",
    creatorId: creator._id,
    startAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // started yesterday
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // ends in 30 days
  });

  // 4. Create successful investment to meet funding goal
  console.log("Creating investment of 21053 TND (matching fundingGoal)...");
  const investment = await Investment.create({
    investorId: investor._id,
    projectId: project._id,
    amount: 21053,
    status: "SUCCESS"
  });

  // Create corresponding transaction
  const paymentId = "mock_pm_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  await Transaction.create({
    investmentId: investment._id,
    amount: 21053,
    status: "SUCCEEDED",
    provider: "FLOUCI",
    providerPaymentId: paymentId,
    succeededAt: new Date()
  });

  // Mark project as funded
  project.currentFunding = 21053;
  project.status = "FUNDED";
  project.fundedAt = new Date();
  await project.save();

  console.log("Project state: currentFunding = 21053, status = FUNDED");

  // 5. Ensure payout creation
  console.log("Ensuring payout is created for the project...");
  await payoutService.ensurePayoutForFundedProject(project._id);
  const payout = await Payout.findOne({ projectId: project._id });
  console.log(`Created Payout ID: ${payout._id}, Payout Amount: ${payout.amount} TND`);

  // 6. Provide bank details
  console.log("Providing creator bank details...");
  const bankJson = JSON.stringify({
    accountHolderName: "TEST CREATOR",
    iban: "TN5912345678901234567890",
    bankName: "BIAT",
    swiftCode: "BIATTNTT"
  });
  await payoutService.provideBankDetails(creator._id, payout._id, bankJson);

  // 7. Approve payout
  console.log("Approving payout as Admin...");
  const approveRes = await payoutService.approvePayout({
    adminId: admin._id,
    payoutId: payout._id,
    notes: "Approved payout with platform fee commission test"
  });

  console.log("Approve response transferUrl:", approveRes.transferUrl);

  // Parse amount from transferUrl to see what is sent to the provider
  const urlParams = new URLSearchParams(approveRes.transferUrl.split("?")[1]);
  const transferAmount = urlParams.get("amount");
  console.log(`=> Amount passed to mock bank transfer: ${transferAmount} TND`);

  // 8. Confirm payout transfer
  console.log("Confirming payout transfer as COMPLETED...");
  await payoutService.confirmMockPayoutTransfer({
    adminId: admin._id,
    payoutId: payout._id,
    providerTransferId: approveRes.payout.providerTransferId,
    status: "COMPLETED"
  });

  // 9. Inspect the generated invoice
  console.log("Checking generated PAYOUT invoice in DB...");
  const invoice = await Invoice.findOne({ type: "PAYOUT", referenceId: payout._id });
  if (!invoice) {
    console.error("❌ ERROR: No payout invoice was generated!");
  } else {
    console.log("=========================================");
    console.log("🎉 SUCCESS: PAYOUT INVOICE GENERATED");
    console.log("=========================================");
    console.log(`- Invoice Number:   ${invoice.invoiceNumber}`);
    console.log(`- Net Paid Base (amount):  ${invoice.amount} TND (expected: 20000 TND)`);
    console.log(`- Platform Fee HT (fee):   ${invoice.fee} TND`);
    console.log(`- TVA 19% (tax):           ${invoice.tax} TND`);
    console.log(`- Total Raised (total):    ${invoice.total} TND (expected: 21053 TND)`);
    console.log(`- Status:                  ${invoice.status}`);
    console.log("=========================================");
  }

  await mongoose.disconnect();
  console.log("Done.");
  process.exit(0);
}

main().catch(async (e) => {
  console.error("Test Failed:", e);
  await mongoose.disconnect();
  process.exit(1);
});
