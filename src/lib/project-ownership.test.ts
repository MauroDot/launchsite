import assert from "node:assert/strict";
import test from "node:test";
import { canAccessProject } from "./project-ownership";

test("a standard user can access only their own project", () => {
  const user = { id: "user-a", role: "USER" as const };
  assert.equal(canAccessProject(user, "user-a"), true);
  assert.equal(canAccessProject(user, "user-b"), false);
  assert.equal(canAccessProject(user, null), false);
});

test("an administrator does not silently gain private-project ownership", () => {
  assert.equal(canAccessProject({ id: "admin", role: "ADMIN" }, "user-a"), false);
});
