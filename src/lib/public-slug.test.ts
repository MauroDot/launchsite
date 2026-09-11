import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizePublicSlug, slugCandidate, validatePublicSlug } from "./public-slug";

describe("public slugs", () => {
  it("normalizes a business name into a stable public slug", () => {
    assert.equal(normalizePublicSlug(" Summit Ridge Roofing! "), "summit-ridge-roofing");
  });

  it("creates collision-safe suffix candidates", () => {
    assert.equal(slugCandidate("summit-ridge-roofing", 2), "summit-ridge-roofing-2");
  });

  it("rejects empty and too-short public slugs", () => {
    assert.equal(validatePublicSlug("--"), null);
    assert.equal(validatePublicSlug("ab"), null);
  });
});
