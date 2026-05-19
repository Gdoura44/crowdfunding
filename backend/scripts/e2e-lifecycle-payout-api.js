require("dotenv").config();

const mongoose = require("mongoose");
require("../models");

const User = require("../models/User");
const Invoice = require("../models/Invoice");

const base = "http://localhost:3000";

function randEmail(prefix) {
  return `${prefix}.${Date.now()}.${Math.random().toString(16).slice(2, 10)}@example.com`.toLowerCase();
}

function joinCookies(setCookieHeaders) {
  const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : setCookieHeaders ? [setCookieHeaders] : [];
  return arr
    .map((h) => String(h).split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function httpJson(path, { method = "GET", cookie = "", body } = {}) {
  const headers = { Accept: "application/json" };
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const setCookie = res.headers.getSetCookie?.() || res.headers.get("set-cookie");
  const cookieOut = joinCookies(setCookie);

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${method} ${path}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }

  return { status: res.status, json, cookie: cookieOut };
}

async function registerVerifyLogin({ email, password, firstName, lastName }) {
  console.log(`[TRACER] Registering user: ${email}...`);
  const s = { cookie: "" };
  const reg = await httpJson("/api/auth/register", {
    method: "POST",
    body: { email, password, confirmPassword: password, firstName, lastName },
  });
  const link = String(reg.json?.devVerificationLink || "");
  const token = link.includes("token=") ? link.split("token=")[1] : "";
  if (!token) throw new Error("No devVerificationLink token returned by /register");

  await httpJson(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, { method: "GET" });

  const login = await httpJson("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });

  s.cookie = login.cookie;
  return s;
}

async function main() {
  const password = "Test12345a";

  console.log("== E2E Enterprise Payout & Invoice Lifecycle Verification ==");

  console.log("[TRACER] Connecting to Mongoose...");
  await mongoose.connect(process.env.DATABASE);
  console.log("[TRACER] Mongoose connected successfully.");

  // Utilisateurs
  const creatorEmail = randEmail("creator.payout");
  const investorEmail = randEmail("investor.payout");
  const adminEmail = randEmail("admin.payout");

  console.log("[TRACER] Starting user setup...");
  const creator = await registerVerifyLogin({
    email: creatorEmail,
    password,
    firstName: "Creator",
    lastName: "PFE",
  });
  const investor = await registerVerifyLogin({
    email: investorEmail,
    password,
    firstName: "Investor",
    lastName: "PFE",
  });
  await registerVerifyLogin({
    email: adminEmail,
    password,
    firstName: "Admin",
    lastName: "PFE",
  });

  console.log("[TRACER] Promoting admin in Database...");
  await User.updateOne({ email: adminEmail }, { $set: { role: "ADMIN" } });

  console.log("[TRACER] Logging in as Admin...");
  const admin = await (async () => {
    const login = await httpJson("/api/auth/login", {
      method: "POST",
      body: { email: adminEmail, password },
    });
    return { cookie: login.cookie };
  })();

  // Créer le projet (startAt doit être >= J+7)
  const startAt = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
  startAt.setHours(0, 0, 0, 0);
  const deadline = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
  deadline.setHours(0, 0, 0, 0);

  console.log("[TRACER] Creating an Enterprise draft project as Creator...");
  const projectCreate = await httpJson("/api/projects", {
    method: "POST",
    cookie: creator.cookie,
    body: {
      title: "FinCollab Green Solar Power",
      description: "Budget:\n- Matériel: 6000 TND\n- Communication: 2000 TND\n- Logistique: 2000 TND",
      category: "Autre",
      fundingGoal: 10000,
      startAt: startAt.toISOString(),
      deadline: deadline.toISOString(),
      isCompany: true,
      companyName: "FinCollab Enterprise S.A.",
      companyMatricule: "1675849/A/M/000",
      companyRNE: "1827463X",
    },
  });
  const projectId = projectCreate.json?.project?._id;
  if (!projectId) throw new Error("No project id returned by POST /api/projects");
  console.log("ProjectId:", projectId);

  console.log("[TRACER] Simulating AI analysis completion directly in Database...");
  const Project = require("../models/Project");
  const now = new Date();
  await Project.updateOne(
    { _id: projectId },
    {
      $set: {
        status: "UNDER_REVIEW",
        aiStatus: "COMPLETED",
        aiCompletedAt: now,
        aiAnalysis: {
          analyzedAt: now,
          successProbability: 88,
          riskLevel: "LOW",
          report: {
            summary: "Excellente viabilité économique, cadre légal d'entreprise valide.",
            advantages: ["Structure d'entreprise solide", "Garanties réelles"],
            disadvantages: [],
            improvements: [],
            removals: [],
            questionsToClarify: [],
          },
          sourcesUsed: [],
          meta: { method: "tests-simulated", model: "none" },
        },
      },
    }
  );

  console.log("[TRACER] Validating project by Admin...");
  await httpJson(`/api/admin/projects/${projectId}/validate`, {
    method: "POST",
    cookie: admin.cookie,
    body: { decision: "APPROVED", feedback: "OK" },
  });

  console.log("[TRACER] Publishing project by Admin...");
  await httpJson(`/api/admin/projects/${projectId}/publish`, {
    method: "POST",
    cookie: admin.cookie,
    body: {},
  });

  console.log("[TRACER] Setting project startAt to yesterday to make it investable...");
  const y = new Date();
  y.setDate(y.getDate() - 1);
  y.setHours(0, 0, 0, 0);
  await Project.updateOne({ _id: projectId }, { $set: { startAt: y } });

  console.log("[TRACER] Making an investment of 10000 TND as Investor...");
  const inv = await httpJson("/api/investments", {
    method: "POST",
    cookie: investor.cookie,
    body: { projectId, amount: 10000 },
  });
  const providerPaymentId = inv.json?.providerPaymentId;
  if (!providerPaymentId) throw new Error("No providerPaymentId returned by POST /api/investments");

  console.log("[TRACER] Confirming investor payment...");
  await httpJson("/api/investments/mock/confirm", {
    method: "POST",
    cookie: investor.cookie,
    body: { providerPaymentId, status: "SUCCEEDED", paymentMethod: "CARD" },
  });

  console.log("[TRACER] Ensuring Payout model instantiation...");
  const payoutService = require("../services/payoutService");
  await payoutService.ensurePayoutForFundedProject(projectId);

  console.log("[TRACER] Listing Creator's payouts...");
  const payouts = await httpJson("/api/payouts/mine?limit=10", { method: "GET", cookie: creator.cookie });
  const payoutId = payouts.json?.payouts?.[0]?._id;
  if (!payoutId) throw new Error("No payout returned by GET /api/payouts/mine");
  console.log("PayoutId:", payoutId);

  console.log("[TRACER] Submitting Creator bank details...");
  const bankJson = JSON.stringify({
    accountHolderName: "FINCOLLAB ENTERPRISE SA",
    iban: "TN590000000000000000000000",
    bankName: "BIAT Tunisie",
    swiftCode: "BIATTNTT",
  });

  await httpJson(`/api/payouts/${payoutId}/bank-details`, {
    method: "PUT",
    cookie: creator.cookie,
    body: { bankDetails: bankJson },
  });

  console.log("[TRACER] Approving Payout by Admin...");
  const approveRes = await httpJson(`/api/admin/payouts/${payoutId}/approve`, {
    method: "POST",
    cookie: admin.cookie,
    body: { notes: "Virement de fonds approuvé par l'administration" },
  });
  const providerTransferId = approveRes.json?.payout?.providerTransferId;
  console.log("[TRACER] Payout approved. providerTransferId:", providerTransferId);

  console.log("[TRACER] Simulating final bank confirmation (COMPLETED)...");
  await httpJson(`/api/admin/payouts/${payoutId}/mock-confirm`, {
    method: "POST",
    cookie: admin.cookie,
    body: { providerTransferId, status: "COMPLETED" },
  });

  console.log("[TRACER] Verifying final payout status...");
  const payoutFinal = await httpJson(`/api/payouts/${payoutId}`, { method: "GET", cookie: creator.cookie });
  console.log("Final Payout status:", payoutFinal.json?.payout?.status);

  console.log("[TRACER] Querying generated corporate Invoice from database...");
  const invoiceDoc = await Invoice.findOne({ type: "PAYOUT", projectId })
    .populate("projectId")
    .populate("userId")
    .lean();

  if (!invoiceDoc) {
    throw new Error("No payout invoice generated! Payout flow failed.");
  }

  console.log("\n=======================================================");
  console.log("🎉 SUCCESS: VERIFIED INVOICE (FACTURE) DATA STRUCTURE:");
  console.log("=======================================================");
  console.log(`- Facture N°:      ${invoiceDoc.invoiceNumber}`);
  console.log(`- Type:            ${invoiceDoc.type}`);
  console.log(`- Projet soutenu:  ${invoiceDoc.projectId?.title}`);
  console.log(`- Porté par Cie?   ${invoiceDoc.projectId?.isCompany}`);
  console.log(`- Nom Entreprise:  ${invoiceDoc.projectId?.companyName}`);
  console.log(`- Matricule Fisc:  ${invoiceDoc.projectId?.companyMatricule}`);
  console.log(`- Numéro RNE:      ${invoiceDoc.projectId?.companyRNE}`);
  console.log(`- Montant Total:   ${invoiceDoc.total} TND`);
  console.log("=======================================================\n");

  console.log("OK: payout & invoicing lifecycle completed successfully.");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("E2E FAILED:", e?.message || e);
  if (e?.body) console.error("Body:", JSON.stringify(e.body, null, 2));
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
