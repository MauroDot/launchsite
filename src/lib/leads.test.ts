import assert from "node:assert/strict";
import test from "node:test";
import { validateLeadInput } from "./leads/validation";
test("lead validation accepts required fields", () => { assert.deepEqual(validateLeadInput({ slug: "example-site", name: "Ada", email: "ada@example.com", message: "Hello" }), { slug: "example-site", name: "Ada", email: "ada@example.com", phone: null, message: "Hello" }); });
test("lead validation rejects honeypot and malformed fields", () => { assert.throws(() => validateLeadInput({ slug: "example-site", name: "Ada", email: "bad", message: "Hello" })); assert.throws(() => validateLeadInput({ slug: "example-site", name: "Ada", email: "ada@example.com", message: "Hello", website: "bot" })); assert.throws(() => validateLeadInput({ slug: "example-site", name: "Ada", email: "ada@example.com", message: "" })); });
