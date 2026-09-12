/* eslint-disable @typescript-eslint/no-require-imports -- Install test doubles before loading server modules. */
const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");

// Exercise actual repository, authorization, actions, and rendering against an
// in-memory persistence boundary. Never load credentials or write customer data.
let currentUser;
let records;
let updates;
let failWrite;
let race;
let featuredRows;
const invalidated = [];
const prisma = {
  $queryRaw: async () => [],
  $transaction: async (work) => work(prisma),
  billingAccount: { findUnique: async () => ({ plan: "BUSINESS", subscriptionStatus: "active", stripeSubscriptionId: "sub_fixture", currentPeriodEnd: null, cancelAtPeriodEnd: false }) },
  user: { findUnique: async () => currentUser },
  websiteProject: {
    count: async ({ where }) => [...records.values()].filter((p) => p.userId === where.userId && p.isPublished).length,
    findUnique: async ({ where }) => records.get(where.id) ?? null,
    findFirst: async ({ where }) => {
      if (where.publicSlug && !where.NOT) assert.equal(where.isPublished, true, "public lookup must require publication");
      return [...records.values()].find((p) =>
        (!where.publicSlug || p.publicSlug === where.publicSlug) &&
        (!where.slug || p.slug === where.slug) &&
        (where.isPublished === undefined || p.isPublished === where.isPublished) &&
        (where.isDemo === undefined || p.isDemo === where.isDemo) &&
        (!where.NOT || p.id !== where.NOT.id)) ?? null;
    },
    update: async ({ where, data }) => {
      if (failWrite) throw new Error("SECRET database connection failure");
      if (race) { race = false; records.set("racer", { ...records.get("a"), id: "racer", publicSlug: data.publicSlug }); throw { code: "P2002" }; }
      if (data.publicSlug && [...records.values()].some((p) => p.id !== where.id && p.publicSlug === data.publicSlug)) throw { code: "P2002" };
      updates++;
      const result = { ...records.get(where.id), ...data };
      records.set(where.id, result);
      return result;
    },
  },
  featuredBusiness: { findMany: async ({ where, select }) => {
    assert.equal(where.enabled, true);
    assert.ok(where.OR[1].startsAt.lte instanceof Date);
    assert.ok(where.AND[0].OR[1].endsAt.gte instanceof Date);
    assert.deepEqual(where.project, { is: {} });
    assert.equal(select.project.select.isDemo, undefined);
    assert.equal(select.project.select.userId, undefined);
    return featuredRows;
  } },
};
function stub(name, exports) { const id = require.resolve(name); require.cache[id] = { id, filename: id, loaded: true, exports }; }
stub("../src/lib/prisma.ts", { prisma });
stub("../src/auth.ts", { auth: async () => currentUser ? { user: { email: "test@example.test" } } : null });
stub("next/cache", { revalidatePath: (...args) => invalidated.push(args) });
process.env.ADMIN_EMAILS = "";
const repo = require("../src/lib/project-repository.ts");
const actions = require("../src/app/actions/projects.ts");
const { requireAdmin } = require("../src/lib/access.ts");
const { SiteRenderer } = require("../src/components/site-renderer.tsx");
const { renderToStaticMarkup } = require("react-dom/server");
const React = require("react");
const { defaultSiteSettings, defaultThemeSettings } = require("../src/lib/website-types.ts");
const { createEditableContentFromDeterministic } = require("../src/lib/generate-site-content.ts");

function record(id = "a", overrides = {}) {
  return { id, userId: id, slug: `internal-${id}`, businessName: "Red River Garage Door Solutions", businessType: "Garage doors", businessDescription: "Garage door installation and service.", serviceArea: "Tulsa", phone: "918-555-0100", email: "business@example.test", yearsInBusiness: null, brandTone: "Warm and welcoming", primaryCallToAction: "Get in touch", visualStyle: "Modern", status: "DRAFT", createdAt: new Date(), updatedAt: new Date(), isDemo: false, isPublished: false, publicSlug: null, publishedAt: null, lastPublishedAt: null, factualNotes: "SECRET factual notes", businessStory: null, customerPriorities: null, differentiators: null, services: [{ name: "Installation", description: "", notes: "SECRET service notes", position: 0 }], workSamples: [{ id: "SECRET media id", mediaType: "VIDEO", mediaUrl: "https://res.cloudinary.com/demo/video/upload/dog.mp4", title: "Our work", description: "A completed installation", cloudinaryPublicId: "SECRET cloudinary id", position: 0 }], testimonials: [{ id: "SECRET testimonial id", customerName: "Sam", testimonialText: "Helpful service", position: 0 }], generatedContent: null, siteSettings: null, ...overrides };
}
beforeEach(() => { currentUser = { id: "a", role: "USER" }; records = new Map([["a", record()], ["b", record("b")]]); updates = 0; failWrite = false; race = false; featuredRows = []; invalidated.length = 0; });

test("owner publishes, sees saved edits, changes address, unpublishes and republishes without losing content", async () => {
  assert.equal(await repo.getPublicProject("red-river-garage-door-solutions"), null);
  const published = await repo.publishProject("a");
  const slug = published.publicSlug;
  currentUser = null;
  assert.equal((await repo.getPublicProject(slug)).business.businessName, record().businessName);
  currentUser = { id: "a", role: "USER" };
  const content = createEditableContentFromDeterministic(published);
  content.hero.headline = "Saved public headline";
  assert.notEqual((await repo.getPublicProject(slug)).generatedContent?.hero.headline, content.hero.headline);
  await repo.saveSiteContent("a", content, defaultSiteSettings);
  assert.equal((await repo.getPublicProject(slug)).generatedContent.hero.headline, "Saved public headline");
  await repo.publishProject("a", "red-river-new");
  assert.equal(await repo.getPublicProject(slug), null);
  await repo.unpublishProject("a");
  assert.equal(await repo.getPublicProject("red-river-new"), null);
  assert.equal((await repo.getProject("a")).generatedContent.hero.headline, "Saved public headline");
  assert.equal(records.get("a").publicSlug, "red-river-new");
  assert.equal((await repo.publishProject("a")).publicSlug, "red-river-new");
  assert.equal(records.get("a").publishedAt, published.publishedAt);
});

test("other user, unrelated admin, and signed-out visitor cannot publish, rename, or unpublish", async () => {
  for (const user of [{ id: "b", role: "USER" }, { id: "admin", role: "ADMIN" }, null]) {
    currentUser = user;
    await assert.rejects(repo.publishProject("a"));
    await assert.rejects(repo.publishProject("a", "stolen-url"));
    await assert.rejects(repo.unpublishProject("a"));
    assert.equal(await repo.getPublicProject("internal-a"), null);
  }
  assert.equal(updates, 0);
});

test("admin may manage official demos, while admin access remains protected", async () => {
  await assert.rejects(requireAdmin());
  currentUser = null;
  await assert.rejects(requireAdmin());
  currentUser = { id: "admin", role: "ADMIN" };
  await requireAdmin();
  await assert.rejects(repo.saveDemoSettings("a", { isDemo: true, featured: true, demoTitle: "", demoDescription: "", demoSortOrder: "" }));
  records.get("a").isDemo = true;
  await repo.publishProject("a");
  await repo.unpublishProject("a");
  assert.ok(await repo.getDemoProject("internal-a"));
  assert.equal(await repo.getDemoProject("internal-b"), null);
});

test("automatic slug collisions and concurrent reservations retry; custom duplicates do not overwrite", async () => {
  const first = await repo.publishProject("a");
  currentUser = { id: "b", role: "USER" };
  await assert.rejects(repo.publishProject("b", first.publicSlug), /already reserved/);
  assert.equal((await repo.publishProject("b")).publicSlug, `${first.publicSlug}-2`);
  currentUser = { id: "a", role: "USER" };
  records.get("a").publicSlug = null;
  race = true;
  assert.equal((await repo.publishProject("a")).publicSlug, `${first.publicSlug}-3`);
});

test("malformed slugs do not resolve or mutate; database failures return safe action errors", async () => {
  await repo.publishProject("a", "valid-address");
  for (const slug of ["", "ab", "VALID-ADDRESS", " valid-address ", "valid--address", "valid/address", "x".repeat(73), null, 12]) {
    assert.equal(await repo.getPublicProject(slug), null);
    await assert.rejects(repo.publishProject("a", slug));
  }
  failWrite = true;
  const result = await actions.publishProjectAction("a");
  assert.equal(result.ok, false);
  assert.doesNotMatch(result.error, /SECRET|stack|connection failure/);
  assert.equal((await actions.unpublishProjectAction("a")).ok, false);
});

test("public DTO excludes internal IDs, notes, media metadata and extra JSON keys", async () => {
  const privateProject = await repo.getProject("a");
  const content = createEditableContentFromDeterministic(privateProject);
  content.debug = "SECRET raw generation";
  content.hero.prompt = "SECRET prompt";
  content.services[0].notes = "SECRET generated notes";
  records.get("a").generatedContent = content;
  records.get("a").siteSettings = { ...defaultSiteSettings, theme: { ...defaultThemeSettings, debug: "SECRET theme" } };
  await repo.publishProject("a");
  const publicSite = await repo.getPublicProject(records.get("a").publicSlug);
  assert.doesNotMatch(JSON.stringify(publicSite), /SECRET|factualNotes|userId|cloudinaryPublicId|createdAt|isDemo|status|internal-a/);
  assert.equal(publicSite.business.email, "business@example.test");
});

test("featured placements link only published customer sites and keep private project copy out", async () => {
  featuredRows = [
    { displayTitle: null, promotionalDescription: null, imageUrl: null, project: record() },
    { displayTitle: "Promotional title", promotionalDescription: "Approved ad", imageUrl: null, project: record() },
    { displayTitle: null, promotionalDescription: null, imageUrl: null, project: record("b", { isPublished: true, publicSlug: "live-customer" }) },
  ];
  assert.deepEqual(await repo.listPublicFeaturedBusinesses(), [
    { title: "Promotional title", description: "Approved ad", imageUrl: null, href: null },
    { title: record().businessName, description: record().businessDescription, imageUrl: null, href: "/site/live-customer" },
  ]);
});

test("publish and rename invalidate public route pattern and admin views", async () => {
  assert.equal((await actions.publishProjectAction("a")).ok, true);
  assert.ok(invalidated.some(([path, type]) => path === "/site/[slug]" && type === "page"));
  assert.ok(invalidated.some(([path]) => path === "/admin/projects"));
});

test("shared renderer handles all layouts, dark/light themes, factual contact links, video, escaping and long text", async () => {
  await repo.publishProject("a");
  const project = await repo.getPublicProject(records.get("a").publicSlug);
  project.business.businessName = "LongBusinessName".repeat(20) + "<script>alert(1)</script>";
  for (const layoutFamily of ["Classic", "Conversion", "Showcase"]) {
    for (const backgroundColor of ["#ffffff", "#111827"]) {
      project.siteSettings = { ...defaultSiteSettings, layoutFamily, theme: { ...defaultThemeSettings, backgroundColor } };
      const html = renderToStaticMarkup(React.createElement(SiteRenderer, { project }));
      assert.match(html, /tel:9185550100/);
      assert.match(html, /mailto:business@example.test/);
      assert.match(html, /<video/);
      assert.match(html, /Helpful service/);
      assert.match(html, /overflow-wrap:anywhere/);
      assert.doesNotMatch(html, /<script>|SECRET|\/dashboard|\/admin|Sign in/);
    }
  }
  project.business.phone = "";
  project.business.email = "";
  const html = renderToStaticMarkup(React.createElement(SiteRenderer, { project }));
  assert.doesNotMatch(html, /tel:|mailto:/);
});
