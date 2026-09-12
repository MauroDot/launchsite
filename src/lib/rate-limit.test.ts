import assert from "node:assert/strict";
import { test } from "node:test";
import { rateLimit } from "./rate-limit";
test("rate limiter allows the configured burst and rejects the next request", () => { const key = `test-${Math.random()}`; assert.equal(rateLimit(key, 2, 60_000).ok, true); assert.equal(rateLimit(key, 2, 60_000).ok, true); const blocked = rateLimit(key, 2, 60_000); assert.equal(blocked.ok, false); assert.ok(blocked.retryAfter > 0); });
