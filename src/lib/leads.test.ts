import assert from "node:assert/strict";
import test from "node:test";
import { validateLeadInput } from "./leads/validation";
import { selectLeadNotificationRecipient } from "./leads/recipient";
test("lead validation accepts required fields", () => { assert.deepEqual(validateLeadInput({ slug: "example-site", name: "Ada", email: "ada@example.com", message: "Hello" }), { slug: "example-site", name: "Ada", email: "ada@example.com", phone: null, message: "Hello" }); });
test("lead validation rejects honeypot and malformed fields", () => { assert.throws(() => validateLeadInput({ slug: "example-site", name: "Ada", email: "bad", message: "Hello" })); assert.throws(() => validateLeadInput({ slug: "example-site", name: "Ada", email: "ada@example.com", message: "Hello", website: "bot" })); assert.throws(() => validateLeadInput({ slug: "example-site", name: "Ada", email: "ada@example.com", message: "" })); });
test("lead notification chooses project contact, then owner, never visitor", () => { assert.equal(selectLeadNotificationRecipient({ email: "business@example.com", user: { email: "owner@example.com" } }), "business@example.com"); assert.equal(selectLeadNotificationRecipient({ email: "", user: { email: "owner@example.com" } }), "owner@example.com"); assert.equal(selectLeadNotificationRecipient({ email: null, user: null }), null); });
