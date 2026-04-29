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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function registerVerifyLogin({ email, password, firstName, lastName }) {
  const reg = await httpJson("/api/auth/register", {
    method: "POST",
    body: { email, password, confirmPassword: password, firstName, lastName },
  });
  assert(reg.ok, `register failed (${reg.status})`);
  const link = String(reg.json?.devVerificationLink || "");
  const token = link.includes("token=") ? link.split("token=")[1] : "";
  assert(token, "No devVerificationLink token returned by /register");

  const ver = await httpJson(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, { method: "GET" });
  assert(ver.ok, `verify-email failed (${ver.status})`);

  const login = await httpJson("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  assert(login.ok, `login failed (${login.status})`);

  return { cookie: login.cookie, email };
}

async function promoteAdmin(email) {
  await mongoose.connect(process.env.DATABASE);
  await User.updateOne({ email }, { $set: { role: "ADMIN" } });
  await mongoose.disconnect();
}

async function setProjectAiCompleted(projectId) {
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
          successProbability: 72,
          riskLevel: "MEDIUM",
          report: {
            summary: "Analyse IA simulée (tests).",
            advantages: [],
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
  await mongoose.disconnect();
}

async function setProjectStartAtYesterday(projectId) {
  await mongoose.connect(process.env.DATABASE);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  y.setHours(0, 0, 0, 0);
  await Project.updateOne({ _id: projectId }, { $set: { startAt: y } });
  await mongoose.disconnect();
}

async function createProjectAsCreator(creatorCookie, { title, goal = 10000 } = {}) {
  const startAt = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
  startAt.setHours(0, 0, 0, 0);
  const deadline = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
  deadline.setHours(0, 0, 0, 0);

  const out = await httpJson("/api/projects", {
    method: "POST",
    cookie: creatorCookie,
    body: {
      title: title || "Projet Test",
      description: "d",
      category: "Autre",
      fundingGoal: goal,
      startAt: startAt.toISOString(),
      deadline: deadline.toISOString(),
    },
  });
  assert(out.ok, `create project failed (${out.status})`);
  const projectId = out.json?.project?._id;
  assert(projectId, "No project id returned by POST /api/projects");
  return projectId;
}

async function getProject(creatorCookie, projectId) {
  const p = await httpJson(`/api/projects/${projectId}`, { method: "GET", cookie: creatorCookie });
  assert(p.ok, `get project failed (${p.status})`);
  return p.json?.project;
}

async function scenarioApproveThenRevoke({ creator, admin }) {
  console.log("\n[Scenario] APPROVED then revoke approval (request changes)");
  const projectId = await createProjectAsCreator(creator.cookie, { title: "ApproveThenRevoke" });
  await setProjectAiCompleted(projectId);

  const approve = await httpJson(`/api/admin/projects/${projectId}/validate`, {
    method: "POST",
    cookie: admin.cookie,
    body: { decision: "APPROVED", feedback: "OK" },
  });
  assert(approve.ok, `approve failed (${approve.status})`);

  const revoke = await httpJson(`/api/admin/projects/${projectId}/revoke-approval`, {
    method: "POST",
    cookie: admin.cookie,
    body: { reason: "Informations manquantes (tests)" },
  });
  assert(revoke.ok, `revoke-approval failed (${revoke.status})`);

  const p = await getProject(creator.cookie, projectId);
  assert(p.status === "REJECTED", `expected REJECTED after revoke, got ${p.status}`);
  console.log("OK");
}

async function scenarioApprovePublishThenSuspendReactivate({ creator, admin }) {
  console.log("\n[Scenario] APPROVED -> ACTIVE -> SUSPENDED -> reactivated");
  const projectId = await createProjectAsCreator(creator.cookie, { title: "SuspendReactivate" });
  await setProjectAiCompleted(projectId);

  const approve = await httpJson(`/api/admin/projects/${projectId}/validate`, {
    method: "POST",
    cookie: admin.cookie,
    body: { decision: "APPROVED", feedback: "OK" },
  });
  assert(approve.ok, `approve failed (${approve.status})`);

  const pub = await httpJson(`/api/admin/projects/${projectId}/publish`, { method: "POST", cookie: admin.cookie });
  assert(pub.ok, `publish failed (${pub.status})`);

  const p1 = await getProject(creator.cookie, projectId);
  assert(p1.status === "ACTIVE", `expected ACTIVE, got ${p1.status}`);

  const susp = await httpJson(`/api/admin/projects/${projectId}/deactivate`, {
    method: "POST",
    cookie: admin.cookie,
    body: { reason: "Test suspension" },
  });
  assert(susp.ok, `deactivate failed (${susp.status})`);

  const p2 = await getProject(creator.cookie, projectId);
  assert(p2.status === "SUSPENDED", `expected SUSPENDED, got ${p2.status}`);

  const react = await httpJson(`/api/admin/projects/${projectId}/reactivate`, {
    method: "POST",
    cookie: admin.cookie,
    body: {},
  });
  assert(react.ok, `reactivate failed (${react.status})`);

  const p3 = await getProject(creator.cookie, projectId);
  assert(["UNDER_REVIEW", "AWAITING_AI"].includes(p3.status), `expected UNDER_REVIEW/AWAITING_AI, got ${p3.status}`);
  console.log("OK");
}

async function scenarioRetryFailedPayment({ creator, admin, investor }) {
  console.log("\n[Scenario] Payment FAILED then retry -> new payment link");
  const projectId = await createProjectAsCreator(creator.cookie, { title: "RetryPayment" });
  await setProjectAiCompleted(projectId);

  await httpJson(`/api/admin/projects/${projectId}/validate`, {
    method: "POST",
    cookie: admin.cookie,
    body: { decision: "APPROVED", feedback: "OK" },
  });
  await httpJson(`/api/admin/projects/${projectId}/publish`, { method: "POST", cookie: admin.cookie });
  await setProjectStartAtYesterday(projectId);

  const inv = await httpJson("/api/investments", {
    method: "POST",
    cookie: investor.cookie,
    body: { projectId, amount: 10000 },
  });
  assert(inv.ok, `create investment failed (${inv.status})`);

  const providerPaymentId = inv.json?.providerPaymentId;
  const investmentId = inv.json?.investment?._id;
  assert(providerPaymentId && investmentId, "missing providerPaymentId/investmentId");

  // Mark FAILED
  const fail = await httpJson("/api/investments/mock/confirm", {
    method: "POST",
    cookie: investor.cookie,
    body: { providerPaymentId, status: "FAILED", paymentMethod: "CARD" },
  });
  assert(fail.ok, `mock confirm FAILED failed (${fail.status})`);

  // Retry should return new providerPaymentId
  const retry = await httpJson(`/api/investments/${investmentId}/retry`, {
    method: "POST",
    cookie: investor.cookie,
    body: {},
  });
  assert(retry.ok, `retry failed (${retry.status})`);
  assert(retry.json?.providerPaymentId && retry.json.providerPaymentId !== providerPaymentId, "retry did not return new providerPaymentId");
  console.log("OK");
}

async function scenarioOverfundingRefund({ creator, admin, investor }) {
  console.log("\n[Scenario] Overfunding (2 investors) -> refund prevents exceeding goal");
  const projectId = await createProjectAsCreator(creator.cookie, { title: "OverfundingRefund", goal: 10000 });
  await setProjectAiCompleted(projectId);

  await httpJson(`/api/admin/projects/${projectId}/validate`, {
    method: "POST",
    cookie: admin.cookie,
    body: { decision: "APPROVED", feedback: "OK" },
  });
  await httpJson(`/api/admin/projects/${projectId}/publish`, { method: "POST", cookie: admin.cookie });
  await setProjectStartAtYesterday(projectId);

  const investorB = await registerVerifyLogin({
    email: randEmail("investorB.sc"),
    password: "Test12345a",
    firstName: "InvestorB",
    lastName: "Sc",
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
  assert(invA.ok && invB.ok, "create investments failed");

  await httpJson("/api/investments/mock/confirm", {
    method: "POST",
    cookie: investor.cookie,
    body: { providerPaymentId: invA.json.providerPaymentId, status: "SUCCEEDED", paymentMethod: "CARD" },
  });
  await httpJson("/api/investments/mock/confirm", {
    method: "POST",
    cookie: investorB.cookie,
    body: { providerPaymentId: invB.json.providerPaymentId, status: "SUCCEEDED", paymentMethod: "CARD" },
  });

  const p = await getProject(creator.cookie, projectId);
  assert(Number(p.currentFunding || 0) <= Number(p.fundingGoal || 0), "currentFunding exceeded fundingGoal");
  console.log("OK");
}

async function scenarioCancelAndRefundWithinGrace({ creator, admin, investor }) {
  console.log("\n[Scenario] Cancel within grace -> refunded (and goal may drop back)");
  const projectId = await createProjectAsCreator(creator.cookie, { title: "CancelRefundGrace", goal: 10000 });
  await setProjectAiCompleted(projectId);

  await httpJson(`/api/admin/projects/${projectId}/validate`, {
    method: "POST",
    cookie: admin.cookie,
    body: { decision: "APPROVED", feedback: "OK" },
  });
  await httpJson(`/api/admin/projects/${projectId}/publish`, { method: "POST", cookie: admin.cookie });
  await setProjectStartAtYesterday(projectId);

  // Invest full goal -> FUNDED
  const inv = await httpJson("/api/investments", {
    method: "POST",
    cookie: investor.cookie,
    body: { projectId, amount: 10000 },
  });
  assert(inv.ok, "investment create failed");
  const investmentId = inv.json.investment._id;
  const providerPaymentId = inv.json.providerPaymentId;

  await httpJson("/api/investments/mock/confirm", {
    method: "POST",
    cookie: investor.cookie,
    body: { providerPaymentId, status: "SUCCEEDED", paymentMethod: "CARD" },
  });

  const funded = await getProject(creator.cookie, projectId);
  assert(funded.status === "FUNDED", `expected FUNDED before cancel, got ${funded.status}`);

  // Cancel should be allowed (within grace window)
  const cancel = await httpJson(`/api/investments/${investmentId}/cancel`, {
    method: "POST",
    cookie: investor.cookie,
    body: {},
  });
  if (!cancel.ok) {
    throw new Error(`cancel failed (${cancel.status}): ${JSON.stringify(cancel.json)}`);
  }

  const after = await getProject(creator.cookie, projectId);
  assert(after.status === "ACTIVE", `expected ACTIVE after refunded cancel, got ${after.status}`);
  assert(Number(after.currentFunding || 0) === 0, "expected currentFunding=0 after refund");
  console.log("OK");
}

async function scenarioExpireProjectsCron({ creator, admin }) {
  console.log("\n[Scenario] Expire projects cron -> CLOSED for overdue ACTIVE project");
  const projectId = await createProjectAsCreator(creator.cookie, { title: "ExpireProject", goal: 10000 });
  await setProjectAiCompleted(projectId);
  await httpJson(`/api/admin/projects/${projectId}/validate`, {
    method: "POST",
    cookie: admin.cookie,
    body: { decision: "APPROVED", feedback: "OK" },
  });
  await httpJson(`/api/admin/projects/${projectId}/publish`, { method: "POST", cookie: admin.cookie });
  await setProjectStartAtYesterday(projectId);

  // Make deadline yesterday so it should expire
  await mongoose.connect(process.env.DATABASE);
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  await Project.updateOne({ _id: projectId }, { $set: { deadline: d, status: "ACTIVE" } });
  await mongoose.disconnect();

  const internalSecret = String(process.env.INTERNAL_API_SECRET || "change-me-internal-secret-for-n8n");
  const exp = await fetch(`${base}/internal/expire-projects`, {
    method: "GET",
    headers: { Authorization: `Bearer ${internalSecret}` },
  });
  assert(exp.ok, "internal expire-projects failed");

  const p = await getProject(creator.cookie, projectId);
  assert(p.status === "CLOSED", `expected CLOSED after expire-projects, got ${p.status}`);
  console.log("OK");
}

async function scenarioAutoRejectGap30({ creator, admin }) {
  console.log("\n[Scenario] Auto-reject gap >=30% via internal run-risk-analysis");
  const projectId = await createProjectAsCreator(creator.cookie, { title: "AutoRejectGap", goal: 20000 });

  // Put AWAITING_AI (required by internal auto-reject logic)
  await mongoose.connect(process.env.DATABASE);
  await Project.updateOne({ _id: projectId }, { $set: { status: "AWAITING_AI", aiStatus: "PENDING" } });
  await mongoose.disconnect();

  const internalSecret = String(process.env.INTERNAL_API_SECRET || "change-me-internal-secret-for-n8n");
  const payload = {
    projectId,
    title: "AutoRejectGap",
    // Needs estimation ~10000, but goal 20000 => gap >= 30%
    description:
      "Budget (utilisation des fonds):\n- Matériel : 5 000 TND\n- Communication : 3 000 TND\n- Logistique : 2 000 TND",
    category: "Autre",
    fundingGoal: 20000,
    deadline: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const resp = await fetch(`${base}/internal/run-risk-analysis`, {
    method: "POST",
    headers: { Authorization: `Bearer ${internalSecret}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`internal run-risk-analysis failed (${resp.status}): ${t}`);
  }
  const j = await resp.json();
  assert(j?.project?._id, "run-risk-analysis did not return project");

  const p = await getProject(creator.cookie, projectId);
  assert(p.status === "REJECTED", `expected REJECTED after auto-reject, got ${p.status}`);
  console.log("OK");
}

async function main() {
  console.log("== E2E lifecycle scenarios ==");
  const password = "Test12345a";

  const creator = await registerVerifyLogin({
    email: randEmail("creator.sc"),
    password,
    firstName: "Creator",
    lastName: "Sc",
  });
  const investor = await registerVerifyLogin({
    email: randEmail("investor.sc"),
    password,
    firstName: "Investor",
    lastName: "Sc",
  });

  const adminEmail = randEmail("admin.sc");
  await registerVerifyLogin({ email: adminEmail, password, firstName: "Admin", lastName: "Sc" });
  await promoteAdmin(adminEmail);
  const adminLogin = await httpJson("/api/auth/login", { method: "POST", body: { email: adminEmail, password } });
  const admin = { cookie: adminLogin.cookie, email: adminEmail };

  await scenarioApproveThenRevoke({ creator, admin });
  await scenarioApprovePublishThenSuspendReactivate({ creator, admin });
  await scenarioRetryFailedPayment({ creator, admin, investor });
  await scenarioOverfundingRefund({ creator, admin, investor });
  await scenarioCancelAndRefundWithinGrace({ creator, admin, investor });
  await scenarioExpireProjectsCron({ creator, admin });
  await scenarioAutoRejectGap30({ creator, admin });

  console.log("\nOK: all scenarios passed");
  process.exit(0);
}

main().catch((e) => {
  console.error("SCENARIOS FAILED:", e?.message || e);
  process.exit(1);
});

