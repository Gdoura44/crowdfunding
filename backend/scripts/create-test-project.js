/**
 * create-test-project.js
 * ──────────────────────
 * Creates a realistic test project in the database so it can be sent
 * through the risk-analysis (AI) pipeline.
 *
 * Usage:
 *   cd backend && node scripts/create-test-project.js
 *
 * The script will:
 *   1. Find the first USER-role account to act as creatorId
 *   2. Insert a project with status AWAITING_AI (ready for AI risk analysis)
 *   3. Print the created project details
 */

require("dotenv").config();
const mongoose = require("mongoose");
require("../models");

const User = require("../models/User");
const Project = require("../models/Project");

// ── Project data ────────────────────────────────────────────────────
const REAL_BUDGET = 50000; // 50 000 TND
const COMMISSION_RATE = 0.05; // 5 %
const TVA_RATE = 0.19; // 19 % TVA on commission
const COMMISSION = REAL_BUDGET * COMMISSION_RATE;
const TVA = COMMISSION * TVA_RATE;
const FUNDING_GOAL = Math.ceil(REAL_BUDGET + COMMISSION + TVA); // ≈ 52 650 TND

const projectData = {
  title: "Ferme Hydroponique Urbaine — Tunis",
  description:
    `Ce projet vise à créer une ferme hydroponique urbaine au cœur de Tunis, ` +
    `produisant des légumes frais toute l'année sans terre ni pesticides. ` +
    `L'installation utilisera un système NFT (Nutrient Film Technique) sur 500 m² ` +
    `dans un entrepôt réaménagé à La Marsa. La production ciblera tomates cerises, ` +
    `laitues, herbes aromatiques et fraises, avec une capacité de 2 tonnes/mois. ` +
    `Le projet prévoit la vente directe aux restaurants, hôtels et marchés locaux ` +
    `via une plateforme de commande en ligne. L'objectif est d'atteindre le seuil ` +
    `de rentabilité en 14 mois et de générer un retour sur investissement de 22 % ` +
    `dès la troisième année.`,
  category: "Agriculture",
  realBudget: REAL_BUDGET,
  fundingGoal: FUNDING_GOAL,
  currentFunding: 0,
  status: "AWAITING_AI",
  aiStatus: "PENDING",
  startAt: new Date(), // starts now
  deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
  isCompany: true,
  companyName: "GreenGrow Tunisie SARL",
  companyMatricule: "1234567A",
  companyRNE: "B0987654",
};

async function main() {
  console.log("=================================================");
  console.log("  CREATE TEST PROJECT FOR RISK ANALYSIS");
  console.log("=================================================\n");

  const dbUri = process.env.DATABASE || "mongodb://127.0.0.1:27017/crowdfunding";
  console.log("📡 Connecting to:", dbUri);
  await mongoose.connect(dbUri);
  console.log("✅ Connected.\n");

  // ── Find a creator ──────────────────────────────────────────────
  // Use the first USER-role account; fall back to any non-admin account.
  let creator = await User.findOne({ role: "USER", isActive: true, deletedAt: null });
  if (!creator) {
    creator = await User.findOne({ role: { $ne: "ADMIN" }, isActive: true, deletedAt: null });
  }
  if (!creator) {
    console.error("❌ No eligible user found in the database. Create an account first.");
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`👤 Using creator: ${creator.profile?.firstName || ""} ${creator.profile?.lastName || ""} (${creator.email})`);
  console.log(`   ID: ${creator._id}\n`);

  // ── Create the project ──────────────────────────────────────────
  projectData.creatorId = creator._id;

  const project = await Project.create(projectData);

  console.log("=========================================");
  console.log("🎉 PROJECT CREATED SUCCESSFULLY");
  console.log("=========================================");
  console.log(`  ID:            ${project._id}`);
  console.log(`  Title:         ${project.title}`);
  console.log(`  Category:      ${project.category}`);
  console.log(`  Real Budget:   ${project.realBudget.toLocaleString()} TND`);
  console.log(`  Funding Goal:  ${project.fundingGoal.toLocaleString()} TND`);
  console.log(`  Status:        ${project.status}`);
  console.log(`  AI Status:     ${project.aiStatus}`);
  console.log(`  Company:       ${project.companyName}`);
  console.log(`  Deadline:      ${project.deadline.toISOString().split("T")[0]}`);
  console.log(`  Creator:       ${creator.email}`);
  console.log("=========================================\n");
  console.log("➡️  The project is now in AWAITING_AI status.");
  console.log("   It will appear in the admin panel and can be sent to AI risk analysis.");

  await mongoose.disconnect();
  console.log("\n✅ Done.");
  process.exit(0);
}

main().catch(async (e) => {
  console.error("❌ Script failed:", e);
  await mongoose.disconnect();
  process.exit(1);
});
