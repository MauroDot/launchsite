/* eslint-disable @typescript-eslint/no-require-imports -- Install test doubles before loading server modules. */
const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");

let actor;
let project;
let domain;
let allowed;
let removed;
const prisma = {
  websiteProject: { findUnique: async () => project },
  domain: {
    findUnique: async () => domain,
    findFirst: async ({ where }) => { const matches = where.OR?.some((clause) => clause.hostname === domain?.hostname || clause.projectId === domain?.projectId); return matches ? domain : null; },
    create: async ({ data, select }) => { domain = { id: "domain-1", ...data, canonical: data.canonical ?? true, verifiedAt: null }; return select ? domain : domain; },
    update: async ({ data }) => { domain = { ...domain, ...data }; return domain; },
    delete: async () => { domain = null; },
  },
};
function stub(name, exports) { const id = require.resolve(name); require.cache[id] = { id, filename: id, loaded: true, exports }; }
stub("../src/lib/prisma.ts", { prisma });
stub("../src/lib/access.ts", { requireProjectAccess: async () => actor });
stub("../src/lib/billing/entitlements.ts", { getUserEntitlements: async () => ({ canUseCustomDomain: allowed }) });
stub("../src/lib/domains/vercel.ts", { addProjectDomain: async () => ({ verified: true, verification: [{ type: "CNAME", domain: "example.com", value: "cname.vercel-dns.com" }] }), getProjectDomain: async () => ({ verified: true }), getDomainConfiguration: async () => ({ recommendedCnames: [{ name: "example.com", value: "cname.vercel-dns.com" }] }), removeProjectDomain: async () => { removed = true; }, statusFromVercel: (value) => value.verified ? "ACTIVE" : "VERIFYING" });
const { connectProjectDomain, disconnectProjectDomain } = require("../src/lib/domains/service.ts");
const { getAppUrl } = require("../src/lib/app-url.ts");

beforeEach(() => { actor = { id: "user-a", role: "USER" }; project = { id: "project-a", userId: "user-a", isPublished: true, isDemo: false }; domain = null; allowed = true; removed = false; });

test("Free and Starter users cannot connect domains", async () => {
  allowed = false;
  await assert.rejects(() => connectProjectDomain("project-a", "example.com"), /active paid plan/i);
});

test("Business user can connect a verified domain without making it canonical", async () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://launchsite-two.vercel.app";
  process.env.VERCEL_URL = "customer.example.com";
  const result = await connectProjectDomain("project-a", "Example.com");
  assert.equal(result.hostname, "example.com");
  assert.equal(result.status, "ACTIVE");
  assert.equal(result.canonical, false);
  assert.equal(getAppUrl(), "https://launchsite-two.vercel.app");
});

test("ownership and hostname uniqueness are enforced", async () => {
  actor = { id: "user-b", role: "USER" };
  await assert.rejects(() => connectProjectDomain("project-a", "example.com"), /published customer sites/i);
  actor = { id: "user-a", role: "USER" };
  domain = { id: "domain-other", projectId: "project-other", hostname: "example.com", canonical: true, status: "ACTIVE", verifiedAt: null };
  await assert.rejects(() => connectProjectDomain("project-a", "example.com"), /already connected/i);
});

test("disconnect removes only the domain association and preserves the project", async () => {
  domain = { id: "domain-1", projectId: "project-a", hostname: "example.com", canonical: true, status: "ACTIVE", verifiedAt: null };
  await disconnectProjectDomain("project-a");
  assert.equal(removed, true);
  assert.equal(domain, null);
  assert.equal(project.id, "project-a");
});

test("canonical LaunchSite domain cannot be disconnected", async () => {
  domain = { id: "domain-1", projectId: "project-a", hostname: "launchsite-two.vercel.app", canonical: true, status: "ACTIVE", verifiedAt: null };
  await assert.rejects(() => disconnectProjectDomain("project-a"), /canonical LaunchSite domain/i);
  assert.equal(removed, false);
  assert.equal(domain.hostname, "launchsite-two.vercel.app");
});
