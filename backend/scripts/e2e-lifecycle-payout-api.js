require("dotenv").config();

const mongoose = require("mongoose");
require("../models");

const User = require("../models/User");

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

  console.log("== E2E lifecycle payout via API ==");

  // Utilisateurs
  const creatorEmail = randEmail("creator.payout");
  const investorEmail = randEmail("investor.payout");
  const adminEmail = randEmail("admin.payout");

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

  // Promote admin (DB)
  await mongoose.connect(process.env.DATABASE);
  await User.updateOne({ email: adminEmail }, { $set: { role: "ADMIN" } });
  await mongoose.disconnect();

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

  const projectCreate = await httpJson("/api/projects", {
    method: "POST",
    cookie: creator.cookie,
    body: {
      title: "Projet Payout Test",
      description: "Budget:\n- Matériel: 6000 TND\n- Communication: 2000 TND\n- Logistique: 2000 TND",
      category: "Autre",
      fundingGoal: 10000,
      startAt: startAt.toISOString(),
      deadline: deadline.toISOString(),
    },
  });
  const projectId = projectCreate.json?.project?._id;
  if (!projectId) throw new Error("No project id returned by POST /api/projects");
  console.log("ProjectId:", projectId);

  // Simuler la fin de l’analyse IA (helper DB / update direct) pour débloquer la validation admin.
  // Mise à jour DB minimale pour permettre la validation (champs aiAnalysis requis)
  await mongoose.connect(process.env.DATABASE);
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
          successProbability: 72,
          riskLevel: "MEDIUM",
          report: {
            summary: "Analyse IA simulée (tests).",
            advantages: ["Cohérence globale"],
            disadvantages: ["Détails à compléter"],
            improvements: ["Ajouter des jalons et livrables."],
            removals: [],
            questionsToClarify: [],
          },
          sourcesUsed: [],
          meta: { method: "tests-simulated", model: "none" },
        },
      },
    }
  );
  await mongoose.disconnect();

  // Validate + publish
  await httpJson(`/api/admin/projects/${projectId}/validate`, {
    method: "POST",
    cookie: admin.cookie,
    body: { decision: "APPROVED", feedback: "OK" },
  });
  await httpJson(`/api/admin/projects/${projectId}/publish`, {
    method: "POST",
    cookie: admin.cookie,
    body: {},
  });

  // Make investable now (DB)
  await mongoose.connect(process.env.DATABASE);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  y.setHours(0, 0, 0, 0);
  await Project.updateOne({ _id: projectId }, { $set: { startAt: y } });
  await mongoose.disconnect();

  // Invest + mock confirm
  const inv = await httpJson("/api/investments", {
    method: "POST",
    cookie: investor.cookie,
    body: { projectId, amount: 10000 },
  });
  const providerPaymentId = inv.json?.providerPaymentId;
  if (!providerPaymentId) throw new Error("No providerPaymentId returned by POST /api/investments");

  await httpJson("/api/investments/mock/confirm", {
    method: "POST",
    cookie: investor.cookie,
    body: { providerPaymentId, status: "SUCCEEDED", paymentMethod: "CARD" },
  });

  const projAfter = await httpJson(`/api/projects/${projectId}`, { method: "GET", cookie: creator.cookie });
  console.log("After payment:", {
    status: projAfter.json?.project?.status,
    currentFunding: projAfter.json?.project?.currentFunding,
    fundingGoal: projAfter.json?.project?.fundingGoal,
  });

  // Ensure payout (direct service)
  await mongoose.connect(process.env.DATABASE);
  const payoutService = require("../services/payoutService");
  await payoutService.ensurePayoutForFundedProject(projectId);
  await mongoose.disconnect();

  // Creator list payouts
  const payouts = await httpJson("/api/payouts/mine?limit=10", { method: "GET", cookie: creator.cookie });
  const payoutId = payouts.json?.payouts?.[0]?._id;
  if (!payoutId) throw new Error("No payout returned by GET /api/payouts/mine");
  console.log("PayoutId:", payoutId);

  // Bank details + approve
  const bankJson = JSON.stringify({
    accountHolderName: "CREATOR PFE",
    iban: "TN590000000000000000000000",
    bankName: "Banque Test",
    swiftCode: "ABCDEFGH",
  });

  await httpJson(`/api/payouts/${payoutId}/bank-details`, {
    method: "PUT",
    cookie: creator.cookie,
    body: { bankDetails: bankJson },
  });

  await httpJson(`/api/admin/payouts/${payoutId}/approve`, {
    method: "POST",
    cookie: admin.cookie,
    body: { notes: "Validé (test)" },
  });

  const payoutFinal = await httpJson(`/api/payouts/${payoutId}`, { method: "GET", cookie: creator.cookie });
  console.log("Payout status:", payoutFinal.json?.payout?.status);

  console.log("OK: payout lifecycle completed");
  process.exit(0);
}

main().catch((e) => {
  console.error("E2E FAILED:", e?.message || e);
  if (e?.body) console.error("Body:", JSON.stringify(e.body, null, 2));
  process.exit(1);
});

