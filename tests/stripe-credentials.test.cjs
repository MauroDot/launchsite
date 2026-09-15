/* eslint-disable @typescript-eslint/no-require-imports -- mock SDK construction without network requests. */
const assert = require("node:assert/strict");
const { test, beforeEach, afterEach } = require("node:test");
const sdkPath = require.resolve("stripe");
const originalSdk = require.cache[sdkPath];
const merchantPath = require.resolve("../src/lib/payments/stripe.ts");
const billingPath = require.resolve("../src/lib/billing/stripe.ts");
let originalEnv;
beforeEach(() => {
  originalEnv = { STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY, STRIPE_CONNECT_SECRET_KEY: process.env.STRIPE_CONNECT_SECRET_KEY };
  delete require.cache[merchantPath];
  delete require.cache[billingPath];
  require.cache[sdkPath] = { id: sdkPath, filename: sdkPath, loaded: true,
    exports: class Stripe { constructor(key, options) { this.key = key; this.options = options; } } };
});
afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  delete require.cache[merchantPath];
  delete require.cache[billingPath];
  if (originalSdk) require.cache[sdkPath] = originalSdk; else delete require.cache[sdkPath];
});

test("merchant and SaaS clients authenticate with distinct credentials and keep separate caches", () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_billing_boundary";
  process.env.STRIPE_CONNECT_SECRET_KEY = "  sk_test_connect_boundary  ";
  const { getMerchantStripe } = require(merchantPath);
  const { getStripe } = require(billingPath);
  const merchant = getMerchantStripe(), billing = getStripe();
  assert.equal(merchant.key, "sk_test_connect_boundary");
  assert.equal(billing.key, "sk_test_billing_boundary");
  assert.notEqual(merchant, billing);
  assert.equal(getMerchantStripe(), merchant); assert.equal(getStripe(), billing);
  assert.equal(merchant.options.apiVersion, "2026-08-26.dahlia");
  assert.deepEqual(billing.options, { maxNetworkRetries: 1, timeout: 5000 });
});

for (const missing of [undefined, "", "   "]) {
  test(`missing/blank Connect key fails safely without billing fallback (${JSON.stringify(missing)})`, () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_billing_boundary";
    if (missing === undefined) delete process.env.STRIPE_CONNECT_SECRET_KEY;
    else process.env.STRIPE_CONNECT_SECRET_KEY = missing;
    const { getMerchantStripe } = require(merchantPath);
    const { getStripe } = require(billingPath);
    const { PaymentError } = require("../src/lib/payments/validation.ts");
    assert.throws(getMerchantStripe, (error) => error instanceof PaymentError && error.message === "Card payments are not configured yet.");
    assert.equal(getStripe().key, "sk_test_billing_boundary");
  });
}

test("Connect works without SaaS key; billing never falls back to Connect", () => {
  delete process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_CONNECT_SECRET_KEY = "sk_test_connect_boundary";
  const { getMerchantStripe } = require(merchantPath);
  const { getStripe } = require(billingPath);
  assert.equal(getMerchantStripe().key, "sk_test_connect_boundary");
  assert.throws(getStripe, { code: "BILLING_NOT_CONFIGURED" });
});
