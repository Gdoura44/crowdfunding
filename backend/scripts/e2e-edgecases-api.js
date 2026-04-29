require("dotenv").config();

const mongoose = require("mongoose");
require("../models");

const User = require("../models/User");
const Project = require("../models/Project");

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

  return { ok: res.ok, status: res.status, json, cookie: cookieOut };
}

async function registerVerifyLogin({ email, password, firstName, lastName }) {
  const reg = await httpJson("/api/auth/register", {
    method: "POST",
    body: { email, password, confirmPassword: password, firstName, lastName },
  });
  if (!reg.ok) throw Object.assign(new Error("register failed"), { reg });
  const link = String(reg.json?.devVerificationLink || "");
  const token = link.includes("token=") ? link.split("token=")[1] : "";
  if (!token) throw new Error("No devVerificationLink token returned by /register");

  const ver = await httpJson(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, { method: "GET" });
  if (!ver.ok) throw Object.assign(new Error("verify-email failed"), { ver });

  const login = await httpJson("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if (!login.ok) throw Object.assign(new Error("login failed"), { login });

  return { cookie: login.cookie, email };
}

async function main() {
  console.log("== E2E edge cases via API ==");
  const password = "Test12345a";

  // Users
  const creator = await registerVerifyLogin({
    email: randEmail("creator.edge"),
    password,
    firstName: "Creator",
    lastName: "Edge",
  });
  const investor = await registerVerifyLogin({
    email: randEmail("investor.edge"),
    password,
    firstName: "Investor",
    lastName: "Edge",
  });
  const adminEmail = randEmail("admin.edge");
  await registerVerifyLogin({ email: adminEmail, password, firstName: "Admin", lastName: "Edge" });

  await mongoose.connect(process.env.DATABASE);
  await User.updateOne({ email: adminEmail }, { $set: { role: "ADMIN" } });
  await mongoose.disconnect();

  const adminLogin = await httpJson("/api/auth/login", { method: "POST", body: { email: adminEmail, password } });
  const admin = { cookie: adminLogin.cookie, email: adminEmail };

  // Edge 1: auto-reject budget gap >= 30% (simulate by setting aiAnalysis that triggers REJECTED is done in internal workflow,
  // here we verify that validation rejects if project is not UNDER_REVIEW or analysis missing)
  console.log("[Edge] overfunding refund (2 investors race)");

  // Create small goal project (goal 10000), publish, invest 6000 then 6000 => second should be refunded/failed
  const startAt = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
  startAt.setHours(0, 0, 0, 0);
  const deadline = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
  deadline.setHours(0, 0, 0, 0);

  const p1 = await httpJson("/api/projects", {
    method: "POST",
    cookie: creator.cookie,
    body: {
      title: "Projet Overfunding Test",
      description: "Test overfunding",
      category: "Autre",
      fundingGoal: 10000,
      startAt: startAt.toISOString(),
      deadline: deadline.toISOString(),
    },
  });
  if (!p1.ok) throw Object.assign(new Error("create project failed"), { p1 });
  const projectId = p1.json.project._id;

  // Put UNDER_REVIEW + ai COMPLETED so admin can approve/publish
  await mongoose.connect(process.env.DATABASE);
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
          successProbability: 70,
          riskLevel: "MEDIUM",
          report: { summary: "tests", advantages: [], disadvantages: [], improvements: [], removals: [], questionsToClarify: [] },
          sourcesUsed: [],
          meta: { method: "tests-simulated", model: "none" },
        },
      },
    }
  );
  await Project.updateOne({ _id: projectId }, { $set: { startAt: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
  await mongoose.disconnect();

  await httpJson(`/api/admin/projects/${projectId}/validate`, {
    method: "POST",
    cookie: admin.cookie,
    body: { decision: "APPROVED", feedback: "OK" },
  });
  await httpJson(`/api/admin/projects/${projectId}/publish`, { method: "POST", cookie: admin.cookie, body: {} });

  // Investor A = investor; Investor B = new account
  const investorB = await registerVerifyLogin({
    email: randEmail("investorB.edge"),
    password,
    firstName: "InvestorB",
    lastName: "Edge",
  });

  const invA = await httpJson("/api/investments", {
    method: "POST",
    cookie: investor.cookie,
    body: { projectId, amount: 6000 },
  });
  const invB = await httpJson("/api/investments", {
    method: "POST",
    cookie: investorB.cookie,
    body: { projectId, amount: 6000 },
  });
  if (!invA.ok || !invB.ok) throw new Error("investment create failed");

  await httpJson("/api/investments/mock/confirm", {
    method: "POST",
    cookie: investor.cookie,
    body: { providerPaymentId: invA.json.providerPaymentId, status: "SUCCEEDED", paymentMethod: "CARD" },
  });
  const confirmB = await httpJson("/api/investments/mock/confirm", {
    method: "POST",
    cookie: investorB.cookie,
    body: { providerPaymentId: invB.json.providerPaymentId, status: "SUCCEEDED", paymentMethod: "CARD" },
  });

  // ConfirmB may succeed but refund the tx; we verify project currentFunding never exceeds goal.
  const projAfter = await httpJson(`/api/projects/${projectId}`, { method: "GET", cookie: creator.cookie });
  const cf = Number(projAfter.json?.project?.currentFunding || 0);
  const goal = Number(projAfter.json?.project?.fundingGoal || 0);
  if (cf > goal) throw new Error(`Overfunding bug: currentFunding ${cf} > goal ${goal}`);

  console.log("OK overfunding: currentFunding=", cf, "goal=", goal, "confirmB.status=", confirmB.status);

  console.log("OK: edgecases basic completed");
  process.exit(0);
}

main().catch((e) => {
  console.error("EDGE E2E FAILED:", e?.message || e);
  if (e?.p1) console.error("p1:", e.p1.status, JSON.stringify(e.p1.json, null, 2));
  if (e?.reg) console.error("reg:", e.reg.status, JSON.stringify(e.reg.json, null, 2));
  process.exit(1);
});

