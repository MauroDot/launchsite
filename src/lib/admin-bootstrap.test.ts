import assert from "node:assert/strict";
import test from "node:test";
import { isBootstrapAdmin } from "./admin-bootstrap";

test("the bootstrap allowlist is case-insensitive and server-controlled", () => {
  assert.equal(isBootstrapAdmin("OWNER@example.com", "owner@example.com, second@example.com"), true);
  assert.equal(isBootstrapAdmin("user@example.com", "owner@example.com"), false);
  assert.equal(isBootstrapAdmin(null, "owner@example.com"), false);
});
