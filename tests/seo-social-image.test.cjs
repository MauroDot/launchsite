/* eslint-disable @typescript-eslint/no-require-imports -- test doubles are installed before server modules load. */
const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");

let actor;
let project;
const prisma = {
  user: { findUnique: async () => actor ? { id: actor.id, role: actor.role } : null },
  websiteProject: {
    findUnique: async () => project ? { userId: project.userId, isDemo: false } : null,
    update: async ({ data }) => { project = { ...project, ...data }; return project; },
  },
};
function stub(name, exports) { const id = require.resolve(name); require.cache[id] = { id, filename: id, loaded: true, exports }; }
stub("../src/lib/prisma.ts", { prisma });
stub("../src/auth.ts", { auth: async () => actor ? { user: { email: actor.email } } : null });
const { updateProjectSeo } = require("../src/lib/seo-settings.ts");

beforeEach(() => {
  actor = { id: "owner", email: "owner@example.test", role: "USER" };
  project = { id: "project-a", userId: "owner", seoTitle: null, seoDescription: null, socialImageUrl: null, allowIndexing: true };
});

test("owner can set an uploaded Cloudinary social image", async () => {
  await updateProjectSeo("project-a", { seoTitle: "Title", seoDescription: "Description", socialImageUrl: "https://res.cloudinary.com/demo/image/upload/social.jpg", allowIndexing: true });
  assert.equal(project.socialImageUrl, "https://res.cloudinary.com/demo/image/upload/social.jpg");
});

test("unauthorized user cannot change another project's image", async () => {
  actor = { id: "other", email: "other@example.test", role: "USER" };
  await assert.rejects(() => updateProjectSeo("project-a", { seoTitle: "", seoDescription: "", socialImageUrl: "https://res.cloudinary.com/demo/image/upload/other.jpg", allowIndexing: true }), /NOT_FOUND/);
  assert.equal(project.socialImageUrl, null);
});

test("removing the image stores null so the public fallback is restored", async () => {
  project.socialImageUrl = "https://res.cloudinary.com/demo/image/upload/social.jpg";
  await updateProjectSeo("project-a", { seoTitle: "", seoDescription: "", socialImageUrl: "", allowIndexing: true });
  assert.equal(project.socialImageUrl, null);
});
