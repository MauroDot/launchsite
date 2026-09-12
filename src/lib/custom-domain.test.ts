import { test } from "node:test";
import assert from "node:assert/strict";
import { entitlementsFromBilling } from "./billing/policy";
import { normalizeDomainHostname } from "./domains/validation";
import { canRenderCustomDomain, isInternalHostname } from "./domains/routing";

test("custom domains are available only to active Business subscriptions", () => {
  for (const plan of ["FREE", "STARTER"] as const) assert.equal(entitlementsFromBilling({ plan, subscriptionStatus: "active", stripeSubscriptionId: "sub", currentPeriodEnd: null, cancelAtPeriodEnd: false }).canUseCustomDomain, false);
  assert.equal(entitlementsFromBilling({ plan: "BUSINESS", subscriptionStatus: "active", stripeSubscriptionId: "sub", currentPeriodEnd: null, cancelAtPeriodEnd: false }).canUseCustomDomain, true);
  assert.equal(entitlementsFromBilling({ plan: "BUSINESS", subscriptionStatus: "canceled", stripeSubscriptionId: "sub", currentPeriodEnd: null, cancelAtPeriodEnd: false }).canUseCustomDomain, false);
});

test("domain validation normalizes valid hostnames and rejects unsafe hosts", () => {
  assert.equal(normalizeDomainHostname("  WWW.Example.com. "), "www.example.com");
  for (const value of ["https://example.com", "example.com/path", "example.com:443", "localhost", "127.0.0.1", "customer.vercel.app", "launchsite-two.vercel.app"]) assert.throws(() => normalizeDomainHostname(value));
});

test("custom-domain routing requires active status and publication", () => {
  assert.equal(canRenderCustomDomain("ACTIVE", true), true);
  assert.equal(canRenderCustomDomain("VERIFYING", true), false);
  assert.equal(canRenderCustomDomain("ACTIVE", false), false);
  assert.equal(isInternalHostname("launchsite-two.vercel.app", "launchsite-two.vercel.app"), true);
  assert.equal(isInternalHostname("preview.vercel.app", "launchsite-two.vercel.app"), true);
  assert.equal(isInternalHostname("example.com", "launchsite-two.vercel.app"), false);
});
