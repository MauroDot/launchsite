/* eslint-disable @typescript-eslint/no-require-imports -- Install test doubles before loading server modules. */
const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");

let actor;
let users;
let billing;
let projects;
let deletedProjects;

const prisma = {
  $transaction: async (work) => work(prisma),
  user: {
    findUnique: async ({ where }) => {
      const user = where.id ? users.get(where.id) : [...users.values()].find((candidate) => candidate.email === where.email);
      if (!user) return null;
      return { ...user, billingAccount: billing.get(user.id) ?? null };
    },
    delete: async ({ where }) => { const user = users.get(where.id); users.delete(where.id); return user; },
  },
  billingAccount: {
    update: async ({ where, data }) => { const current = billing.get(where.userId); if (!current) throw { code: "P2025" }; const updated = { ...current, ...data }; billing.set(where.userId, updated); return updated; },
    deleteMany: async ({ where }) => { billing.delete(where.userId); return { count: 1 }; },
  },
  websiteProject: {
    count: async ({ where }) => [...projects.values()].filter((p) => p.userId === where.userId && p.hasMerchantRecords).length,
    updateMany: async ({ where, data }) => { for (const project of projects.values()) if (project.userId === where.userId && project.isDemo === where.isDemo) project.userId = data.userId; return { count: 1 }; },
    deleteMany: async ({ where }) => { for (const [id, project] of projects) if (project.userId === where.userId && project.isDemo === where.isDemo) { projects.delete(id); deletedProjects.push(id); } return { count: deletedProjects.length }; },
  },
  account: { deleteMany: async () => ({ count: 0 }) },
  session: { deleteMany: async () => ({ count: 0 }) },
};

function stub(name, exports) { const id = require.resolve(name); require.cache[id] = { id, filename: id, loaded: true, exports }; }
stub("../src/lib/prisma.ts", { prisma });
stub("../src/auth.ts", { auth: async () => actor ? { user: { email: actor.email } } : null });
const { listAdminUsers, resetUserBilling, deleteUser } = require("../src/lib/admin-user-management.ts");

beforeEach(() => {
  actor = { id: "admin", email: "admin@example.test", role: "ADMIN" };
  users = new Map([
    ["admin", actor],
    ["user-a", { id: "user-a", email: "user-a@example.test", role: "USER" }],
    ["admin-b", { id: "admin-b", email: "admin-b@example.test", role: "ADMIN" }],
  ]);
  billing = new Map([["user-a", { id: "billing-a", userId: "user-a", stripeCustomerId: "cus_test", stripeSubscriptionId: null, stripePriceId: "price_test", plan: "BUSINESS", subscriptionStatus: "active", currentPeriodStart: new Date(), currentPeriodEnd: new Date(), cancelAtPeriodEnd: true, checkoutSessionId: "cs_test", checkoutAttemptId: "attempt", checkoutPlan: "BUSINESS", checkoutPriceId: "price_test", checkoutExpiresAt: new Date() }]]);
  projects = new Map([["site-a", { id: "site-a", userId: "user-a", isDemo: false, isPublished: true }], ["demo-a", { id: "demo-a", userId: "user-a", isDemo: true, isPublished: true }], ["site-other", { id: "site-other", userId: "admin-b", isDemo: false, isPublished: true }]]);
  deletedProjects = [];
});

test("admin can reset a normal user's billing without changing projects or published state", async () => {
  await resetUserBilling("user-a");
  assert.equal(billing.get("user-a").plan, "FREE");
  assert.equal(billing.get("user-a").stripeCustomerId, null);
  assert.equal(billing.get("user-a").subscriptionStatus, null);
  assert.equal(projects.get("site-a").isPublished, true);
  assert.equal(projects.get("demo-a").isPublished, true);
});

test("normal user cannot access user management", async () => {
  actor = users.get("user-a");
  await assert.rejects(() => listAdminUsers(), /forbidden/i);
  await assert.rejects(() => resetUserBilling("admin-b"), /forbidden/i);
});

test("administrator cannot delete self or another administrator", async () => {
  await assert.rejects(() => deleteUser("admin", "admin@example.test"), /own administrator/i);
  await assert.rejects(() => deleteUser("admin-b", "admin-b@example.test"), /administrator accounts/i);
});

test("delete affects only selected user and preserves shared demo projects", async () => {
  await deleteUser("user-a", "user-a@example.test");
  assert.equal(users.has("user-a"), false);
  assert.equal(billing.has("user-a"), false);
  assert.equal(projects.has("site-a"), false);
  assert.equal(projects.get("demo-a").userId, null);
  assert.equal(users.has("admin-b"), true);
  assert.equal(projects.has("site-other"), true);
});

test("delete requires exact target email confirmation", async () => {
  await assert.rejects(() => deleteUser("user-a", "wrong@example.test"), /email exactly/i);
  assert.equal(users.has("user-a"), true);
});

test("merchant records block deletion before any user or SaaS billing data changes", async () => {
  projects.get("site-a").hasMerchantRecords = true;
  await assert.rejects(() => deleteUser("user-a", "user-a@example.test"), /merchant payment/);
  assert.equal(users.has("user-a"), true);
  assert.equal(billing.has("user-a"), true);
  assert.equal(projects.has("site-a"), true);
  assert.equal(projects.get("demo-a").userId, "user-a");
});
