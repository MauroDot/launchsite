import assert from "node:assert/strict";
import test from "node:test";
import { createEditableContentFromDeterministic, createWebsiteProject, generateSiteContent } from "./generate-site-content";
import { validateGeneratedContent } from "./generated-content";
import type { BusinessProfile } from "./website-types";

function business(overrides: Partial<BusinessProfile>): BusinessProfile {
  return { businessName: "Example Business", category: "Home Services", description: "Local home services for nearby customers.", businessStory: "", targetAudience: "", differentiators: "", customerPriorities: "", factualNotes: "", serviceArea: "Tulsa", phone: "555-0100", email: "hello@example.com", services: [{ id: "service-1", name: "General service", description: "Practical help for local customers.", notes: "" }], yearsInBusiness: "", tone: "Warm and welcoming", callToAction: "Request an estimate", secondaryCallToAction: "", ...overrides };
}

test("deterministic fallback keeps automotive and landscaping projects isolated", () => {
  const automotive = generateSiteContent(business({ category: "Mobile Auto Repair", description: "Mobile auto repair for drivers in Tulsa.", services: [{ id: "auto", name: "Brake repair", description: "Brake repair at your location.", notes: "" }] }));
  const landscaping = generateSiteContent(business({ businessName: "GreenLine Outdoor Services", category: "Landscaping & Lawn Care", description: "Landscaping and lawn care for homes in Tulsa.", services: [{ id: "lawn", name: "Lawn mowing", description: "Routine lawn mowing and trimming.", notes: "" }] }));
  const landscapingText = JSON.stringify(landscaping).toLowerCase();

  assert.match(JSON.stringify(automotive).toLowerCase(), /auto repair|brake repair/);
  for (const phrase of ["vehicle repair", "auto repair", "mechanic", "brakes"]) assert.doesNotMatch(landscapingText, new RegExp(phrase));
  assert.match(landscapingText, /landscaping|lawn care|lawn mowing/);
});

test("deterministic content adapts to the complete editable schema", () => {
  const profile = business({ businessName: "GreenLine Outdoor Services", category: "Landscaping & Lawn Care" });
  const editable = createEditableContentFromDeterministic(createWebsiteProject({ business: profile, visualStyle: "Modern", workSamples: [], testimonials: [] }));
  assert.deepEqual(validateGeneratedContent(editable), editable);
  assert.equal(editable.hero.primaryCTA, profile.callToAction);
});
