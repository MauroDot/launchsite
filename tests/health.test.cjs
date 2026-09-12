/* eslint-disable @typescript-eslint/no-require-imports -- install a database test double before loading the route. */
const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
let fail = false;
const prisma = { $queryRaw: async () => { if (fail) throw new Error("database secret details"); return [{ ok: 1 }]; } };
const id = require.resolve("../src/lib/prisma.ts"); require.cache[id] = { id, filename: id, loaded: true, exports: { prisma } };
const { GET } = require("../src/app/api/health/route.ts");
beforeEach(() => { fail = false; process.env.HEALTH_TEST_SECRET = "do-not-render"; });
test("health returns a small success response without configuration values", async () => { const response = await GET(); const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.status, "ok"); assert.equal(body.checks.database, "ok"); assert.doesNotMatch(JSON.stringify(body), /do-not-render|database secret|DATABASE_URL|STRIPE/); });
test("health returns a safe degraded response when the database fails", async () => { fail = true; const response = await GET(); const body = await response.json(); assert.equal(response.status, 503); assert.equal(body.status, "degraded"); assert.equal(body.checks.database, "unavailable"); assert.doesNotMatch(JSON.stringify(body), /database secret/); });
