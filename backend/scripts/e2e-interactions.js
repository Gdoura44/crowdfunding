require("dotenv").config();

const mongoose = require("mongoose");
require("../models");

const User = require("../models/User");
const Project = require("../models/Project");
const Comment = require("../models/Comment");

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
  assert(token, "No devVerificationLink token");
  await httpJson(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, { method: "GET" });
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

async function preparePublishedProject({ creatorCookie, adminCookie, title = "Interactions Project" }) {
  const startAt = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
  startAt.setHours(0, 0, 0, 0);
  const deadline = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
  deadline.setHours(0, 0, 0, 0);

  const p = await httpJson("/api/projects", {
    method: "POST",
    cookie: creatorCookie,
    body: {
      title,
      description: "Budget:\n- Matériel: 6000 TND\n- Communication: 2000 TND\n- Logistique: 2000 TND",
      category: "Autre",
      fundingGoal: 10000,
      startAt: startAt.toISOString(),
      deadline: deadline.toISOString(),
    },
  });
  assert(p.ok, "create project failed");
  const projectId = p.json.project._id;

  // Put UNDER_REVIEW + AI completed, then approve+publish
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
          report: { summary: "tests", advantages: [], disadvantages: [], improvements: [], removals: [], questionsToClarify: [] },
          sourcesUsed: [],
          meta: { method: "tests-simulated", model: "none" },
        },
      },
    }
  );
  await mongoose.disconnect();

  await httpJson(`/api/admin/projects/${projectId}/validate`, {
    method: "POST",
    cookie: adminCookie,
    body: { decision: "APPROVED", feedback: "OK" },
  });
  await httpJson(`/api/admin/projects/${projectId}/publish`, { method: "POST", cookie: adminCookie, body: {} });

  // make investable now for interactions if needed
  await mongoose.connect(process.env.DATABASE);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  y.setHours(0, 0, 0, 0);
  await Project.updateOne({ _id: projectId }, { $set: { startAt: y } });
  await mongoose.disconnect();

  return projectId;
}

async function main() {
  console.log("== E2E interactions (chatbot + comments + moderation) ==");
  const password = "Test12345a";

  const creator = await registerVerifyLogin({
    email: randEmail("creator.inter"),
    password,
    firstName: "Creator",
    lastName: "Inter",
  });
  const user = await registerVerifyLogin({
    email: randEmail("user.inter"),
    password,
    firstName: "User",
    lastName: "Inter",
  });
  const adminEmail = randEmail("admin.inter");
  await registerVerifyLogin({ email: adminEmail, password, firstName: "Admin", lastName: "Inter" });
  await promoteAdmin(adminEmail);
  const adminLogin = await httpJson("/api/auth/login", { method: "POST", body: { email: adminEmail, password } });
  const admin = { cookie: adminLogin.cookie, email: adminEmail };

  const projectId = await preparePublishedProject({
    creatorCookie: creator.cookie,
    adminCookie: admin.cookie,
    title: "Interactions",
  });

  // Chatbot
  const chat = await httpJson(`/api/projects/${projectId}/chat`, {
    method: "POST",
    cookie: user.cookie,
    body: { question: "Quelles sont les règles d’annulation ?" },
  });
  assert(chat.ok, `chat failed (${chat.status})`);
  assert(typeof chat.json?.answer === "string" && chat.json.answer.length > 5, "chat answer missing");
  assert(["ai", "fallback"].includes(String(chat.json?.mode || "")), "chat mode missing");
  console.log("OK chatbot:", chat.json.mode);

  // Comments: create
  const c1 = await httpJson(`/api/projects/${projectId}/comments`, {
    method: "POST",
    cookie: user.cookie,
    body: { content: "Très bonne initiative. Bon courage !" },
  });
  assert(c1.ok, `create comment failed (${c1.status})`);
  const commentId = c1.json?.comment?._id;
  assert(commentId, "commentId missing");

  const list1 = await httpJson(`/api/projects/${projectId}/comments`, { method: "GET", cookie: user.cookie });
  assert(list1.ok, "list comments failed");
  assert((list1.json?.comments || []).some((c) => String(c._id) === String(commentId)), "comment not found in list");
  console.log("OK comments create/list");

  // Report comment
  const rep = await httpJson("/api/reports/comments", {
    method: "POST",
    cookie: user.cookie, // reporter cannot report own comment; use creator as reporter
    body: { projectId, commentId, type: "INAPPROPRIATE_CONTENT", description: "Test" },
  });
  // This should fail because user is author; verify expected 400
  assert(!rep.ok && rep.status === 400, "expected 400 when reporting own comment");

  const rep2 = await httpJson("/api/reports/comments", {
    method: "POST",
    cookie: creator.cookie,
    body: { projectId, commentId, type: "INAPPROPRIATE_CONTENT", description: "Contenu à vérifier (test)." },
  });
  assert(rep2.ok, `report comment failed (${rep2.status})`);
  console.log("OK report comment");

  // Admin moderation: hide/unhide comment
  const hide = await httpJson(`/api/admin/comments/${commentId}/hide`, {
    method: "PATCH",
    cookie: admin.cookie,
    body: { reason: "Test modération" },
  });
  assert(hide.ok, `hide comment failed (${hide.status})`);

  const list2 = await httpJson(`/api/projects/${projectId}/comments`, { method: "GET", cookie: user.cookie });
  assert(list2.ok, "list comments failed");
  assert(!(list2.json?.comments || []).some((c) => String(c._id) === String(commentId)), "hidden comment still visible");

  const unhide = await httpJson(`/api/admin/comments/${commentId}/unhide`, {
    method: "PATCH",
    cookie: admin.cookie,
    body: {},
  });
  assert(unhide.ok, `unhide comment failed (${unhide.status})`);

  const list3 = await httpJson(`/api/projects/${projectId}/comments`, { method: "GET", cookie: user.cookie });
  assert(list3.ok, "list comments failed");
  assert((list3.json?.comments || []).some((c) => String(c._id) === String(commentId)), "unhidden comment not visible");
  console.log("OK comment hide/unhide");

  // Delete comment by author
  const del = await httpJson(`/api/projects/${projectId}/comments/${commentId}`, {
    method: "DELETE",
    cookie: user.cookie,
  });
  assert(del.ok, `delete comment failed (${del.status})`);

  const list4 = await httpJson(`/api/projects/${projectId}/comments`, { method: "GET", cookie: user.cookie });
  assert(list4.ok, "list comments failed");
  assert(!(list4.json?.comments || []).some((c) => String(c._id) === String(commentId)), "deleted comment still visible");
  console.log("OK comment delete");

  // Cleanup quick sanity: comment exists in DB with deletedAt
  await mongoose.connect(process.env.DATABASE);
  const cdoc = await Comment.findById(commentId).lean();
  await mongoose.disconnect();
  assert(cdoc && cdoc.deletedAt, "expected deletedAt set in DB");

  console.log("\nOK: interactions passed");
  process.exit(0);
}

main().catch((e) => {
  console.error("INTERACTIONS FAILED:", e?.message || e);
  process.exit(1);
});

