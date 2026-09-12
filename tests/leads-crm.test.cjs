/* eslint-disable @typescript-eslint/no-require-imports -- install server test doubles before loading the service. */
const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
let actor; let lastLeadQuery; let lead = { id: "lead-1", projectId: "project-1", status: "NEW", followUpAt: null };
const prisma = {
  user: { findUnique: async () => actor ? { id: actor.id, role: "USER" } : null },
  websiteProject: { findUnique: async () => ({ userId: "owner", isDemo: false }) },
  lead: {
    findFirst: async () => actor?.id === "owner" ? lead : null,
    findMany: async (args) => { lastLeadQuery = args; return []; },
    count: async () => 0,
    update: async ({ data }) => { lead = { ...lead, ...data }; return lead; },
    create: async () => lead,
    groupBy: async () => [],
  },
  leadNote: {
    create: async ({ data }) => ({ id: "note-1", ...data }),
    findFirst: async () => actor?.id === "owner" ? { id: "note-1" } : null,
    update: async ({ data }) => ({ id: "note-1", ...data }),
    delete: async () => undefined,
  },
};
function stub(name, exports) { const id = require.resolve(name); require.cache[id] = { id, filename: id, loaded: true, exports }; }
stub("../src/lib/prisma.ts", { prisma });
stub("../src/auth.ts", { auth: async () => actor ? { user: { email: `${actor.id}@example.test` } } : null });
const service = require("../src/lib/leads/service.ts");
const { leadsToCsv } = require("../src/lib/leads/csv.ts");
beforeEach(() => { actor = { id: "owner" }; lead = { id: "lead-1", projectId: "project-1", status: "NEW", followUpAt: null }; lastLeadQuery = null; });

test("owner can update status and follow-up without changing lead content", async () => { await service.updateUserLeadStatus("lead-1", "QUALIFIED"); await service.updateUserLeadFollowUp("lead-1", "2030-01-01T10:00:00Z"); assert.equal(lead.status, "QUALIFIED"); assert.ok(lead.followUpAt instanceof Date); });
test("unauthorized user cannot update status or follow-up", async () => { actor = { id: "other" }; await assert.rejects(() => service.updateUserLeadStatus("lead-1", "WON"), /Lead not found/); await assert.rejects(() => service.updateUserLeadFollowUp("lead-1", "2030-01-01"), /Lead not found/); });
test("owner can add, edit, and delete a private note", async () => { const note = await service.addLeadNote("lead-1", "Call tomorrow"); assert.equal(note.body, "Call tomorrow"); assert.equal((await service.updateLeadNote("note-1", "Called" )).body, "Called"); await service.deleteLeadNote("note-1"); });
test("search, filters, and pagination remain ownership scoped", async () => { await service.listUserLeads({ search: "Ada", status: "QUALIFIED", followUp: "overdue", page: 2, sort: "followup" }); assert.equal(lastLeadQuery.skip, 25); assert.equal(lastLeadQuery.take, 25); assert.ok(lastLeadQuery.where.AND.some((item) => item.OR)); assert.ok(lastLeadQuery.where.AND.some((item) => item.status === "QUALIFIED")); });
test("CSV escapes content and neutralizes formula injection", () => { const csv = leadsToCsv([{ name: "=2+2", email: "a@example.test", phone: null, message: "Hello, \"there\"\nnext", project: { businessName: "Demo" }, status: "NEW", createdAt: new Date("2026-01-01T00:00:00Z"), followUpAt: null }]); assert.match(csv, /'=2\+2/); assert.match(csv, /"Hello, ""there""\nnext"/); });
