import assert from "node:assert/strict";
import test from "node:test";
import { extractResponseText } from "./openai-response-parser";

test("extracts the Responses API convenience output_text", () => {
  assert.equal(extractResponseText({ output_text: "{\"ok\":true}" }), "{\"ok\":true}");
});

test("extracts nested output_text content from Responses API output", () => {
  assert.equal(extractResponseText({ output: [{ type: "message", content: [{ type: "output_text", text: "{\"first\":1}" }, { type: "output_text", text: "{\"second\":2}" }] }] }), "{\"first\":1}\n{\"second\":2}");
});

test("returns null for empty, failed, and incomplete Responses API output", () => {
  assert.equal(extractResponseText({ output: [] }), null);
  assert.equal(extractResponseText({ status: "failed", output: [{ type: "message", content: [] }] }), null);
  assert.equal(extractResponseText({ status: "incomplete" }), null);
});
