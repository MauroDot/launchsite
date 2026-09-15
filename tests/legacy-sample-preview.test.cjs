/* eslint-disable @typescript-eslint/no-require-imports -- Install server test doubles before loading modules. */
const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const { renderToStaticMarkup } = require("react-dom/server");
let actor, records, failure;
function stub(name, exports) { const id = require.resolve(name); require.cache[id] = { id, filename: id, loaded: true, exports }; }
const matches = (record, where) => Object.entries(where).every(([key, value]) => record[key] === value);
const prisma = {
  user: { findUnique: async () => actor },
  websiteProject: {
    findUnique: async ({ where }) => { if (failure) throw failure; return records.find((r) => matches(r, where)) ?? null; },
    findFirst: async ({ where }) => records.find((r) => matches(r, where)) ?? null,
    findMany: async ({ where }) => records.filter((r) => matches(r, where)),
    update: async ({ where, data }) => Object.assign(records.find((r) => matches(r, where)), data),
  },
  featuredBusiness: { findUnique: async () => null },
};
stub("../src/lib/prisma.ts", { prisma });
stub("../src/auth.ts", { auth: async () => actor ? { user: { email: "actor@example.test" } } : null });
stub("../src/lib/admin-bootstrap.ts", { isBootstrapAdmin: () => false });
const repo = require("../src/lib/project-repository.ts");
const { requireProjectAccess } = require("../src/lib/access.ts");
const Preview = require("../src/app/(launchsite)/dashboard/projects/[id]/preview/page.tsx").default;
const preview = async (id = "sample") => renderToStaticMarkup(await Preview({ params: Promise.resolve({ id }) }));
function sample(overrides = {}) {
  return { id: "sample", userId: null, businessName: "Legacy Roofing", businessType: "Roofing", businessDescription: "Roof repairs", serviceArea: "Tulsa", phone: "", email: "", yearsInBusiness: null, brandTone: "Friendly and approachable", primaryCallToAction: "Request a quote", visualStyle: "Modern", slug: "legacy-roofing", publicSlug: "legacy-roofing", status: "DRAFT", createdAt: new Date(), updatedAt: new Date(), services: [], workSamples: [], testimonials: [], generatedContent: null, siteSettings: null, isDemo: false, featured: false, isPublished: false, paymentSettings: null, domain: null, featuredBusiness: null, ...overrides };
}
beforeEach(() => { actor = { id: "admin", role: "ADMIN" }; records = [sample()]; failure = null; });

test("admin previews an unpublished, unassigned legacy sample without changing its data", async () => {
  const before = structuredClone(records);
  const html = await preview();
  assert.match(html, /Legacy Roofing/);
  assert.match(html, /Unassigned sample/);
  assert.doesNotMatch(html, /temporarily unavailable/);
  assert.deepEqual(records, before);
});
test("owned project still previews for its owner", async () => {
  actor = { id: "owner", role: "USER" };
  records = [sample({ userId: "owner" })];
  assert.match(await preview(), /Legacy Roofing/);
  assert.doesNotMatch(await preview(), /Unassigned sample/);
});
for (const relation of ["paymentSettings", "domain", "featuredBusiness"]) {
  test(`sample renders with no ${relation}`, async () => {
    records = [sample({ isDemo: true, [relation]: null, siteSettings: { layoutFamily: "Showcase", theme: { primaryColor: "#0369a1" } } })];
    assert.match(await preview(), /Return to project/);
    assert.equal((await repo.getProject("sample")).customDomain, undefined);
    assert.equal(await repo.getFeaturedBusiness("sample"), null);
  });
}
test("admin read exception does not grant write access to unmarked samples", async () => {
  await repo.getProject("sample");
  await assert.rejects(() => requireProjectAccess("sample"), /NOT_FOUND/);
  await assert.rejects(() => repo.unpublishProject("sample"), /NOT_FOUND/);
});
test("only admin can explicitly opt an unassigned sample into Examples", async () => {
  const settings = { isDemo: true, featured: false, demoTitle: "", demoDescription: "", demoSortOrder: "" };
  actor = { id: "customer", role: "USER" };
  await assert.rejects(() => repo.saveDemoSettings("sample", settings), /FORBIDDEN/);
  actor = { id: "admin", role: "ADMIN" };
  await repo.saveDemoSettings("sample", settings);
  assert.equal(records[0].userId, null);
  assert.equal(records[0].isPublished, false);
  assert.ok(await repo.getDemoProject("legacy-roofing"));
});
test("public publishing and demo visibility stay independent of unassigned preview access", async () => {
  assert.equal(await repo.getPublicProject("legacy-roofing"), null);
  assert.equal(await repo.getDemoProject("legacy-roofing"), null);
  assert.deepEqual(await repo.listDemoProjects(), []);
  records[0].isDemo = true;
  assert.ok(await repo.getDemoProject("legacy-roofing"));
  assert.equal(await repo.getPublicProject("legacy-roofing"), null);
  records[0].isDemo = false;
  records[0].isPublished = true;
  const publicSite = await repo.getPublicProject("legacy-roofing");
  assert.ok(publicSite);
  for (const key of ["userId", "isUnassignedSample", "paymentSettings", "featuredBusiness"]) assert.equal(key in publicSite, false);
  assert.equal(await repo.getDemoProject("legacy-roofing"), null);
});
test("ordinary users cannot preview unassigned samples, including demos", async () => {
  actor = { id: "customer", role: "USER" };
  for (const isDemo of [false, true]) {
    records[0].isDemo = isDemo;
    await assert.rejects(() => repo.getProject("sample"), /NOT_FOUND/);
    await assert.rejects(() => preview(), /NEXT_HTTP_ERROR_FALLBACK;404/);
  }
});
test("admin cannot preview another customer's private project", async () => {
  records[0].userId = "other-customer";
  await assert.rejects(() => preview(), /NEXT_HTTP_ERROR_FALLBACK;404/);
});
test("operational failure keeps a safe fallback and logs the actual exception with project context", async () => {
  failure = new Error("Database connection failed");
  const logs = [];
  const original = console.error;
  console.error = (...args) => logs.push(args);
  try {
    assert.match(await preview(), /temporarily unavailable/);
    assert.equal(logs[0][1].projectId, "sample");
    assert.equal(logs[0][1].error, failure);
  } finally { console.error = original; }
});
