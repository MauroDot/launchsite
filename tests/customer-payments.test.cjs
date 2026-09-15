/* eslint-disable @typescript-eslint/no-require-imports -- Install server test doubles before loading services. */
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const Stripe = require("stripe");
const { renderToStaticMarkup } = require("react-dom/server");
const realStripe = new Stripe("sk_test_merchant_unit_only");
let actor, tables, calls, accounts, sessions, intents, failure, seq;
let tail = Promise.resolve();
const copy = (v) => structuredClone(v);
function hydrate(model, row) {
  if (!row) return null;
  if (model === "websiteProject") return { ...row, paymentSettings: tables.projectPaymentSettings.find((s) => s.projectId === row.id) ?? null, externalPaymentOptions: tables.externalPaymentOption.filter((l) => l.projectId === row.id), paymentItems: tables.paymentItem.filter((i) => i.projectId === row.id) };
  if (model === "customerPayment") return { ...row, project: tables.websiteProject.find((p) => p.id === row.projectId) };
  return row;
}
function match(row, where = {}) {
  return row && Object.entries(where).every(([k, v]) => {
    if (k === "OR") return v.some((entry) => match(row, entry));
    if (k === "projectId_requestKey") return match(row, v);
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("not" in v) return row[k] !== v.not;
      if ("in" in v) return v.in.includes(row[k]);
      if ("contains" in v) return String(row[k] || "").toLowerCase().includes(v.contains.toLowerCase());
      if ("gte" in v || "lt" in v) return (!v.gte || row[k] >= v.gte) && (!v.lt || row[k] < v.lt);
      return match(row[k], v);
    }
    return row[k] === v;
  });
}
function selected(row, select) {
  if (!row || !select) return copy(row);
  return Object.fromEntries(Object.entries(select).map(([k, v]) => {
    if (v === true) return [k, copy(row[k])];
    if (Array.isArray(row[k])) return [k, row[k].filter((r) => match(r, v.where)).slice(0, v.take ?? Infinity).map((r) => selected(r, v.select))];
    return [k, selected(row[k], v.select)];
  }));
}
function apply(row, data) { for (const [key, value] of Object.entries(data)) row[key] = value && typeof value === "object" && "increment" in value ? (row[key] || 0) + value.increment : copy(value); return row; }
const db = {};
db.user = { findUnique: async ({ where }) => where.id === actor?.id ? { email: actor.email } : null };
for (const model of ["websiteProject", "projectPaymentSettings", "externalPaymentOption", "paymentItem", "customerPayment", "connectWebhookEvent", "billingAccount"]) {
  const find = (where) => tables[model].find((r) => match(hydrate(model, r), where));
  db[model] = {
    findFirst: async ({ where, select }) => selected(hydrate(model, find(where)), select),
    findUnique: async ({ where, select }) => selected(hydrate(model, find(where)), select),
    findMany: async ({ where, select, take, skip = 0 } = {}) => tables[model].filter((r) => match(hydrate(model, r), where)).slice(skip, skip + (take ?? Infinity)).map((r) => selected(hydrate(model, r), select)),
    count: async ({ where }) => tables[model].filter((r) => match(hydrate(model, r), where)).length,
    create: async ({ data }) => {
      if (failure === "event-write" && model === "connectWebhookEvent") throw new Error("test event write failure");
      const row = { id: `row-${++seq}`, receiptSequence: 0, stripeConnectAccountId: null, accountAttemptAt: null, receiptToken: null, receiptNumber: null, paidAt: null, stripePaymentIntentId: null, stripeCheckoutSessionId: null, stripeChargeId: null, refundedAmount: 0, taxAmount: 0, discountAmount: 0, customerEmail: null, customerPhone: null, note: null, externalReference: null, stripeReceiptUrl: null, paymentStatus: "PENDING", currency: "usd", createdAt: new Date(), ...copy(data) };
      if (data.lineItems) row.lineItems = copy(data.lineItems.create);
      tables[model].push(row); return copy(row);
    },
    update: async ({ where, data }) => { const row = find(where); assert.ok(row, `${model} row exists`); return copy(apply(row, data)); },
    updateMany: async ({ where, data }) => { const rows = tables[model].filter((r) => match(hydrate(model, r), where)); rows.forEach((r) => apply(r, data)); return { count: rows.length }; },
    upsert: async ({ where, create, update }) => find(where) ? db[model].update({ where, data: update }) : db[model].create({ data: create }),
  };
}
db.$queryRaw = async (strings, ...values) => {
  if (strings.join("").includes("pg_advisory")) { assert.match(values[0], /^merchant:/); calls.push(["lock", values[0]]); return []; }
  return [{ count: failure === "rate" ? 1000 : 1 }];
};
db.$transaction = async (work) => {
  const previous = tail; let release; tail = new Promise((r) => { release = r; }); await previous;
  const snapshot = copy(tables);
  try { return await work(db); } catch (error) { tables = snapshot; throw error; } finally { release(); }
};
const stripe = {
  webhooks: realStripe.webhooks,
  parseEventNotification: realStripe.parseEventNotification.bind(realStripe),
  accounts: {
    create: async () => { throw new Error("Legacy Accounts v1 must not be used"); },
    retrieve: async () => { throw new Error("Legacy Accounts v1 must not be used"); },
  },
  accountLinks: { create: async () => { throw new Error("Legacy Account Links must not be used"); } },
  v2: { core: {
    accounts: {
      create: async (data, options) => { calls.push(["account-create", data, options]); if (failure instanceof Error) throw failure; const a = activeAccount({ cardStatus: "pending", payoutStatus: "pending" }); accounts.set(a.id, a); return { id: a.id, object: a.object }; },
      retrieve: async (id, params, options) => { calls.push(["account-retrieve", id, params, options]); if (failure === "account-read") throw new Error("test account unavailable"); assert.ok(accounts.has(id)); return copy(accounts.get(id)); },
    },
    accountLinks: { create: async (data, options) => { calls.push(["account-link", data, options]); if (failure === "account-link") throw new Error("test link unavailable"); return { url: "https://connect.stripe.com/setup/test" }; } },
  } },
  checkout: { sessions: {
    create: async (data, options) => {
      calls.push(["checkout", data, options]); const id = `cs_${data.client_reference_id}`;
      const session = { id, mode: "payment", status: "open", url: `https://checkout.stripe.com/c/pay/${id}`, metadata: data.metadata, amount_total: data.line_items[0].price_data.unit_amount, currency: "usd", customer_details: { name: "Stripe Customer", email: "stripe@example.test" }, payment_intent: `pi_${data.client_reference_id}` };
      sessions.set(id, session);
      intents.set(session.payment_intent, { id: session.payment_intent, metadata: data.payment_intent_data.metadata, amount: session.amount_total, amount_received: session.amount_total, currency: "usd", status: "succeeded", latest_charge: { id: `ch_${id}`, paid: true, amount: session.amount_total, currency: "usd", amount_refunded: 0, created: 1700000000, receipt_url: "https://pay.stripe.com/receipts/test", billing_details: session.customer_details } });
      return copy(session);
    },
    retrieve: async (id, _params, options) => { calls.push(["session-retrieve", id, options]); assert.ok(sessions.has(id)); return copy(sessions.get(id)); },
  } },
  paymentIntents: { retrieve: async (id, _params, options) => { calls.push(["intent-retrieve", id, options]); assert.ok(intents.has(id)); return copy(intents.get(id)); } },
};
function mock(path, exports) { const resolved = require.resolve(path); require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports }; }
mock("../src/lib/prisma.ts", { prisma: db });
mock("../src/lib/access.ts", { requireUser: async () => { if (!actor) throw new Error("UNAUTHENTICATED"); return actor; } });
const merchantStripe = require("../src/lib/payments/stripe.ts");
mock("../src/lib/payments/stripe.ts", { ...merchantStripe, getMerchantStripe: () => stripe, retrieveMerchantAccount: (id, context) => merchantStripe.retrieveMerchantAccount(id, context, stripe) });
mock("resend", { Resend: class { emails = { send: async (data, options) => { calls.push(["email", data, options]); return failure === "email" ? { error: { message: "test" } } : { data: { id: "email-id" } }; } }; } });
const service = require("../src/lib/payments/service.ts");
const receipts = require("../src/lib/payments/receipts.ts");
const { receiptPdf } = require("../src/lib/payments/pdf.ts");
const { processConnectEvent, processConnectAccountEvent } = require("../src/lib/payments/webhooks.ts");
const { connectState } = require("../src/lib/payments/stripe.ts");
const validation = require("../src/lib/payments/validation.ts");
const { POST: webhook } = require("../src/app/api/stripe/connect/webhook/route.ts");
const { PublicPayments } = require("../src/components/public-payments.tsx");
const { ReceiptView } = require("../src/components/receipt-view.tsx");
const { GET: ownerPdf } = require("../src/app/api/payments/owner-receipt/[id]/pdf/route.ts");
const { GET: publicPdf } = require("../src/app/api/payments/receipts/[token]/pdf/route.ts");
const { listPayments } = require("../src/lib/payments/queries.ts");
db.customerPayment.groupBy = async ({ where }) => ["STRIPE", "MANUAL_EXTERNAL"].map((paymentSource) => {
  const rows = tables.customerPayment.filter((r) => match(hydrate("customerPayment", r), where) && r.paymentSource === paymentSource);
  return { paymentSource, _count: { _all: rows.length }, _sum: { totalAmount: rows.reduce((sum, r) => sum + r.totalAmount, 0), refundedAmount: rows.reduce((sum, r) => sum + r.refundedAmount, 0) } };
}).filter((row) => row._count._all);
function activeAccount({ cardStatus = "active", payoutStatus = "active", ...extra } = {}) { return { id: "acct_merchant", object: "v2.core.account", dashboard: "full", applied_configurations: ["merchant"], closed: false, defaults: { responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } }, configuration: { merchant: { capabilities: { card_payments: { status: cardStatus, status_details: [] }, stripe_balance: { payouts: { status: payoutStatus, status_details: [] } } } } }, requirements: { entries: [] }, ...extra }; }
function manual(extra = {}) { return { requestId: randomUUID(), customerName: "Customer", customerEmail: "customer@example.test", paidAt: "2026-01-01", items: [{ description: "Service", quantity: 2, unitAmount: "10.10" }], paymentMethod: "CASH", taxAmount: "1.00", discountAmount: "0.20", ...extra }; }
const link = { type: "PAYPAL", label: "Pay with PayPal", url: "https://paypal.me/example", enabled: true, sortOrder: 0 };
function checkout(extra = {}, item = "offer", slug = "business") { return service.createMerchantCheckout(slug, item, { requestId: randomUUID(), ...extra }, "https://launchsite.example"); }
async function stripePayment() { await checkout(); return tables.customerPayment.at(-1); }
function event(type = "checkout.session.completed", payment = tables.customerPayment[0], extra = {}) { return { id: randomUUID(), object: "event", account: "acct_merchant", created: 1700000000, type, data: { object: { id: type.startsWith("checkout") ? payment.stripeCheckoutSessionId : `pi_${payment.id}`, payment_intent: `pi_${payment.id}` } }, ...extra }; }
function thinEvent(type = "v2.core.account[requirements].updated", extra = {}) { return { id: `evt_${randomUUID()}`, object: "v2.core.event", type, created: new Date().toISOString(), livemode: false, related_object: { id: "acct_merchant", type: "v2.core.account", url: "/v2/core/accounts/acct_merchant" }, ...extra }; }
function userRequirement(status = "currently_due") { return { awaiting_action_from: "user", minimum_deadline: { status } }; }
beforeEach(() => {
  actor = { id: "owner", role: "USER", email: "owner@example.test" }; seq = 0; calls = []; failure = null; accounts = new Map([["acct_merchant", activeAccount()]]); sessions = new Map(); intents = new Map();
  tables = Object.fromEntries(["websiteProject", "projectPaymentSettings", "externalPaymentOption", "paymentItem", "customerPayment", "connectWebhookEvent", "billingAccount"].map((k) => [k, []]));
  tables.websiteProject.push({ id: "project", userId: "owner", businessName: "Test Business", email: "business@example.test", phone: "555-0100", isPublished: true, publicSlug: "business", domain: null });
  tables.projectPaymentSettings.push({ id: "settings", projectId: "project", stripeConnectAccountId: "acct_merchant", ...connectState(activeAccount()), receiptSequence: 0 });
  tables.billingAccount.push({ userId: "owner", plan: "STARTER", stripeSubscriptionId: "sub_saas", subscriptionStatus: "active", stripeCustomerId: "cus_saas" });
  tables.paymentItem.push({ id: "offer", projectId: "project", name: "Service deposit", amount: 10000, currency: "usd", type: "DEPOSIT", minAmount: 50, maxAmount: 1000000, enabled: true });
  process.env.NEXT_PUBLIC_APP_URL = "https://launchsite.example";
  process.env.STRIPE_SECRET_KEY = "sk_test_billing_unit_only";
  process.env.STRIPE_CONNECT_SECRET_KEY = "sk_test_merchant_unit_only";
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "whsec_merchant_unit_only";
  process.env.STRIPE_CONNECT_ACCOUNTS_WEBHOOK_SECRET = "whsec_accounts_unit_only";
  process.env.RESEND_API_KEY = "re_unit_only";
  process.env.LEAD_NOTIFICATION_FROM = "LaunchSite <receipts@example.test>";
});

test("owner can add and edit external links; Free can use links", async () => { tables.billingAccount = []; await service.saveExternalOption("project", link); await service.saveExternalOption("project", { ...link, id: tables.externalPaymentOption[0].id, label: "New label" }); assert.equal(tables.externalPaymentOption[0].label, "New label"); });
test("other owner and unrelated admin cannot modify payment links", async () => { for (const role of ["USER", "ADMIN"]) { actor = { id: "other", role }; await assert.rejects(service.saveExternalOption("project", link)); } assert.equal(tables.externalPaymentOption.length, 0); });
test("unsafe payment URL schemes and credentials are rejected", () => { for (const url of ["javascript:alert(1)", "data:text/html,test", "http://bank.test", "https://user:pass@bank.test", "not a url", "https://127.0.0.1/a"]) assert.throws(() => validation.secureUrl(url)); });
test("only enabled external buttons render safely", async () => { await service.saveExternalOption("project", link); await service.saveExternalOption("project", { ...link, label: "Hidden option", enabled: false }); const html = renderToStaticMarkup(await PublicPayments({ slug: "business" })); assert.match(html, /Pay with PayPal/); assert.doesNotMatch(html, /Hidden option/); assert.match(html, /noopener noreferrer/); });
test("Connect requires authentication", async () => { actor = null; await assert.rejects(service.onboardConnect("project")); assert.equal(calls.length, 0); });
test("Connect requires actual project ownership", async () => { actor.id = "other"; await assert.rejects(service.onboardConnect("project")); });
test("Connect reuses existing account and creates canonical hosted onboarding link", async () => { await service.onboardConnect("project"); await service.onboardConnect("project"); assert.equal(calls.filter((c) => c[0] === "account-create").length, 0); const data = calls.find((c) => c[0] === "account-link")[1]; assert.equal(data.account, "acct_merchant"); assert.match(data.use_case.account_onboarding.return_url, /^https:\/\/launchsite.example\/dashboard\/projects\/project\/payments\/connect/); assert.match(data.use_case.account_onboarding.refresh_url, /flow=refresh/); });
test("new Accounts v2 merchant sends only the sandbox-guided payload and reuses its account", async () => {
  tables.projectPaymentSettings = [];
  await service.onboardConnect("project"); await service.onboardConnect("project");
  const creates = calls.filter((c) => c[0] === "account-create");
  assert.equal(creates.length, 1);
  assert.deepEqual(creates[0][1], {
    display_name: "Test Business", contact_email: "business@example.test", identity: { country: "us" }, dashboard: "full",
    defaults: { responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
    configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
  });
  assert.equal(creates[0][2].apiVersion, undefined);
  assert.match(creates[0][2].idempotencyKey, /^merchant-account-v2:/);
  const retrieved = calls.findIndex((c) => c[0] === "account-retrieve");
  assert.ok(retrieved > calls.indexOf(creates[0]));
  assert.ok(retrieved < calls.findIndex((c) => c[0] === "account-link"));
  assert.deepEqual(calls[retrieved][2].include, merchantStripe.ACCOUNT_INCLUDES);
  assert.equal(tables.projectPaymentSettings[0].stripeConnectStatus, "PENDING");
  assert.doesNotMatch(JSON.stringify(creates), /cus_saas|sub_saas/);
});
for (const businessEmail of [null, "", "invalid email", "a".repeat(255) + "@example.test"]) {
  test(`merchant contact email falls back to authenticated owner's email for ${String(businessEmail).slice(0, 20)}`, async () => {
    tables.projectPaymentSettings = []; tables.websiteProject[0].email = businessEmail;
    await service.onboardConnect("project");
    assert.equal(calls.find((c) => c[0] === "account-create")[1].contact_email, "owner@example.test");
  });
}
test("missing valid merchant and owner email prevents remote account creation", async () => {
  tables.projectPaymentSettings = []; tables.websiteProject[0].email = null; actor.email = null;
  await assert.rejects(service.onboardConnect("project"), /valid business email/);
  assert.equal(calls.filter((c) => c[0] === "account-create").length, 0);
});
for (const failedStep of ["account-read", "account-link"]) {
  test(`created account survives ${failedStep} failure and is reused on retry`, async () => {
    tables.projectPaymentSettings = []; failure = failedStep;
    await assert.rejects(service.onboardConnect("project"));
    assert.equal(tables.projectPaymentSettings[0].stripeConnectAccountId, "acct_merchant");
    failure = null; await service.onboardConnect("project");
    assert.equal(calls.filter((c) => c[0] === "account-create").length, 1);
  });
}
test("concurrent onboarding requests create one merchant account", async () => {
  tables.projectPaymentSettings = [];
  await Promise.all([service.onboardConnect("project"), service.onboardConnect("project")]);
  assert.equal(calls.filter((c) => c[0] === "account-create").length, 1);
});
test("payment action logs Stripe diagnostics safely and returns only the generic message", async () => {
  const { paymentAction } = require("../src/app/actions/payments.ts");
  tables.projectPaymentSettings = [];
  failure = new Stripe.errors.StripeInvalidRequestError({ type: "invalid_request_error", code: "account_creation_invalid", message: "Invalid account sk_test_hidden whsec_hidden token=hidden", requestId: "req_test123", headers: { cookie: "private-cookie" } });
  failure.raw.requestBody = { password: "private-password" };
  const logged = []; const original = console.error; console.error = (...args) => logged.push(args);
  try {
    const result = await paymentAction("project", "connect", { ok: false, message: "" }, new FormData());
    assert.equal(result.ok, false);
    assert.match(result.message, /Unable to complete this request/);
    assert.doesNotMatch(result.message, /Invalid account|req_test123|account_creation_invalid/);
    assert.equal(logged[0][1].action, "merchant-connect");
    assert.equal(logged[0][1].error.type, "StripeInvalidRequestError");
    assert.equal(logged[0][1].error.code, "account_creation_invalid");
    assert.equal(logged[0][1].error.requestId, "req_test123");
    assert.match(logged[0][1].error.message, /Invalid account/);
    assert.doesNotMatch(JSON.stringify(logged), /hidden|private-cookie|private-password|requestBody/);
  } finally { console.error = original; }
});
test("ambiguous old account creation attempt fails closed", async () => { Object.assign(tables.projectPaymentSettings[0], { stripeConnectAccountId: null, accountAttemptAt: new Date(0) }); await assert.rejects(service.onboardConnect("project"), /support review/); });
test("account status refresh reflects restrictions and payout capability", async () => { accounts.set("acct_merchant", activeAccount({ cardStatus: "restricted", payoutStatus: "restricted", requirements: { entries: [userRequirement("past_due")] } })); await service.refreshConnect("project"); assert.equal(tables.projectPaymentSettings[0].stripeConnectStatus, "RESTRICTED"); assert.equal(tables.projectPaymentSettings[0].stripePayoutsEnabled, false); });
test("status mapping covers pending, incomplete and disabled accounts", () => { assert.equal(connectState(activeAccount({ cardStatus: "pending", requirements: { entries: [userRequirement()] } })).stripeConnectStatus, "ONBOARDING"); assert.equal(connectState(activeAccount({ cardStatus: "pending" })).stripeConnectStatus, "PENDING"); assert.equal(connectState(activeAccount({ closed: true })).stripeConnectStatus, "DISABLED"); });
test("browser cannot override fixed price, currency or connected merchant", async () => { await checkout({ amount: "0.01", currency: "eur", stripeConnectAccountId: "acct_attacker", priceId: "price_bad" }); const c = calls.find((c) => c[0] === "checkout"); assert.equal(c[1].line_items[0].price_data.unit_amount, 10000); assert.equal(c[1].line_items[0].price_data.currency, "usd"); assert.equal(c[2].stripeAccount, "acct_merchant"); assert.equal(c[1].payment_intent_data.application_fee_amount, undefined); });
test("inactive account cannot start checkout", async () => { tables.projectPaymentSettings[0].stripeConnectStatus = "PENDING"; await assert.rejects(checkout()); });
test("live Stripe eligibility is checked before checkout", async () => { accounts.set("acct_merchant", activeAccount({ cardStatus: "pending" })); await assert.rejects(checkout()); });
test("custom amounts validate minimum and maximum", async () => { tables.paymentItem[0].type = "CUSTOM_AMOUNT"; tables.paymentItem[0].minAmount = 100; tables.paymentItem[0].maxAmount = 10000; await assert.rejects(checkout({ amount: "0.99" })); await assert.rejects(checkout({ amount: "100.01" })); await checkout({ amount: "12.34" }); assert.equal(tables.customerPayment[0].totalAmount, 1234); });
test("amount parser rejects rounding, exponents, negatives and oversized values", () => { for (const value of ["1.001", "1e2", "-1", "NaN", "10000.01", 1.25]) assert.throws(() => validation.money(value)); assert.equal(validation.money("0.29"), 29); });
test("unpublished project cannot create checkout", async () => { tables.websiteProject[0].isPublished = false; await assert.rejects(checkout()); });
test("disabled offer cannot create checkout", async () => { tables.paymentItem[0].enabled = false; await assert.rejects(checkout()); });
test("another project's offer cannot be used", async () => { tables.paymentItem[0].projectId = "other"; await assert.rejects(checkout()); });
test("Free plan cannot start native checkout or create manual payment", async () => { tables.billingAccount = []; await assert.rejects(checkout()); await assert.rejects(service.recordManualPayment("project", manual())); });
test("checkout retry reuses the same pending payment and session", async () => { const requestId = randomUUID(); const one = await checkout({ requestId }); const two = await checkout({ requestId }); assert.equal(one, two); assert.equal(tables.customerPayment.length, 1); assert.equal(calls.filter((c) => c[0] === "checkout").length, 1); assert.equal(tables.customerPayment[0].paymentStatus, "PENDING"); });
test("untrusted origin rejected; active custom domain accepted with canonical returns", async () => { await assert.rejects(service.createMerchantCheckout("business", "offer", { requestId: randomUUID() }, "https://evil.test")); tables.websiteProject[0].domain = { status: "ACTIVE", hostname: "business.example" }; await service.createMerchantCheckout("business", "offer", { requestId: randomUUID() }, "https://business.example"); const c = calls.find((c) => c[0] === "checkout"); assert.match(c[1].success_url, /^https:\/\/launchsite.example\/payment\/success/); assert.equal(service.merchantPublicUrl(tables.websiteProject[0]), "https://business.example"); });
test("invalid Connect signature is rejected", async () => { const response = await webhook(new Request("https://launchsite.example/api/stripe/connect/webhook", { method: "POST", headers: { "stripe-signature": "bad" }, body: "{}" })); assert.equal(response.status, 400); });
test("signed Connect webhook succeeds and preserves SaaS billing", async () => { const p = await stripePayment(); const before = copy(tables.billingAccount); const body = JSON.stringify(event("checkout.session.completed", p)); const signature = realStripe.webhooks.generateTestHeaderString({ payload: body, secret: process.env.STRIPE_CONNECT_WEBHOOK_SECRET }); const response = await webhook(new Request("https://launchsite.example/api/stripe/connect/webhook", { method: "POST", headers: { "stripe-signature": signature }, body })); assert.equal(response.status, 200); assert.deepEqual(tables.billingAccount, before); assert.equal(tables.customerPayment[0].paymentStatus, "PAID"); });
test("duplicate concurrent webhooks create one receipt and transaction", async () => { const p = await stripePayment(); const e = event("checkout.session.completed", p); await Promise.all([processConnectEvent(e), processConnectEvent(e)]); assert.equal(tables.customerPayment.length, 1); assert.equal(tables.connectWebhookEvent.length, 1); assert.equal(tables.projectPaymentSettings[0].receiptSequence, 1); assert.equal(tables.customerPayment[0].receiptNumber, "LS-000001"); });
test("distinct payment events reconcile the same payment once", async () => { const p = await stripePayment(); await processConnectEvent(event("payment_intent.succeeded", p)); await processConnectEvent(event("checkout.session.completed", p)); assert.equal(tables.customerPayment.length, 1); assert.equal(tables.projectPaymentSettings[0].receiptSequence, 1); });
test("webhook failure rolls back state, numbering and event for retry", async () => { const p = await stripePayment(); const e = event("checkout.session.completed", p); failure = "event-write"; await assert.rejects(processConnectEvent(e)); assert.equal(tables.customerPayment[0].receiptNumber, null); assert.equal(tables.customerPayment[0].paymentStatus, "PENDING"); failure = null; await processConnectEvent(e); assert.equal(tables.customerPayment[0].receiptNumber, "LS-000001"); });
test("failed Stripe payment cannot become paid or get a receipt", async () => { const p = await stripePayment(); Object.assign(intents.get(`pi_${p.id}`), { status: "requires_payment_method", last_payment_error: { code: "card_declined" } }); await processConnectEvent(event("payment_intent.payment_failed", p)); assert.equal(tables.customerPayment[0].paymentStatus, "FAILED"); assert.equal(tables.customerPayment[0].receiptNumber, null); });
test("asynchronous unpaid checkout stays pending until Stripe confirms", async () => { const p = await stripePayment(); intents.get(`pi_${p.id}`).status = "processing"; await processConnectEvent(event("checkout.session.completed", p)); assert.equal(tables.customerPayment[0].paymentStatus, "PENDING"); intents.get(`pi_${p.id}`).status = "succeeded"; await processConnectEvent(event("checkout.session.async_payment_succeeded", p)); assert.equal(tables.customerPayment[0].paymentStatus, "PAID"); });
test("refunds sync from current Stripe charge; stale success cannot undo them", async () => { const p = await stripePayment(); const intent = intents.get(`pi_${p.id}`); await processConnectEvent(event()); intent.latest_charge.amount_refunded = 5000; await processConnectEvent(event("charge.refunded", p)); assert.equal(tables.customerPayment[0].paymentStatus, "PARTIALLY_REFUNDED"); intent.latest_charge.amount_refunded = 10000; await processConnectEvent(event("refund.updated", p)); await processConnectEvent(event("payment_intent.succeeded", p)); assert.equal(tables.customerPayment[0].paymentStatus, "REFUNDED"); assert.equal(tables.projectPaymentSettings[0].receiptSequence, 1); });
test("wrong account and mismatched amounts cannot confirm a payment", async () => { const p = await stripePayment(); await processConnectEvent(event("checkout.session.completed", p, { account: "acct_other" })); assert.equal(tables.customerPayment[0].paymentStatus, "PENDING"); intents.get(`pi_${p.id}`).amount = 1; await assert.rejects(processConnectEvent(event())); assert.equal(tables.customerPayment[0].receiptNumber, null); });
test("account events refresh authoritative status", async () => { accounts.set("acct_merchant", activeAccount({ payoutStatus: "restricted" })); await processConnectAccountEvent(thinEvent()); assert.equal(tables.projectPaymentSettings[0].stripePayoutsEnabled, false); });
test("manual payment totals and source are derived server-side", async () => { await service.recordManualPayment("project", manual({ totalAmount: 1, paymentSource: "STRIPE", stripeChargeId: "ch_fake" })); const p = tables.customerPayment[0]; assert.equal(p.subtotal, 2020); assert.equal(p.totalAmount, 2100); assert.equal(p.paymentSource, "MANUAL_EXTERNAL"); assert.equal(p.stripeChargeId, null); assert.equal(p.receiptNumber, "LS-000001"); });
test("manual payment owner checks apply to create and refund", async () => { const id = await service.recordManualPayment("project", manual()); actor.id = "other"; await assert.rejects(service.recordManualPayment("project", manual())); await assert.rejects(service.updateManualStatus("project", id, { status: "REFUNDED" })); });
test("manual request retries do not duplicate a receipt", async () => { const data = manual(); assert.equal(await service.recordManualPayment("project", data), await service.recordManualPayment("project", data)); assert.equal(tables.customerPayment.length, 1); });
test("concurrent receipts get unique sequential per-project numbers", async () => { await Promise.all(Array.from({ length: 12 }, () => service.recordManualPayment("project", manual()))); assert.equal(new Set(tables.customerPayment.map((p) => p.receiptNumber)).size, 12); assert.equal(tables.projectPaymentSettings[0].receiptSequence, 12); });
test("line item totals, dates and discounts are validated", () => { assert.throws(() => validation.manualData(manual({ discountAmount: "999.00" }))); assert.throws(() => validation.manualData(manual({ paidAt: "2026-02-30" }))); assert.throws(() => validation.manualData(manual({ items: [{ description: "Large", quantity: 1000, unitAmount: "10000" }] }))); assert.throws(() => validation.manualData(manual({ paymentMethod: "STRIPE" }))); });
test("receipt token reveals exactly one receipt and excludes internal identifiers", async () => { await service.recordManualPayment("project", manual()); await service.recordManualPayment("project", manual({ customerName: "Another customer" })); const p = tables.customerPayment[0]; assert.match(p.receiptToken, /^[a-f0-9]{64}$/); const r = await receipts.publicReceipt(p.receiptToken); assert.equal(r.customerName, "Customer"); for (const k of ["id", "projectId", "stripeConnectAccountId", "stripePaymentIntentId", "receiptToken", "requestKey"]) assert.equal(r[k], undefined); assert.equal(await receipts.publicReceipt("LS-000001"), null); assert.equal(await receipts.publicReceipt("f".repeat(64)), null); });
test("manual receipt safely renders disclosure and print/download controls", async () => { const id = await service.recordManualPayment("project", manual({ customerName: "<script>alert(1)</script>" })); const r = await receipts.ownerReceipt("project", id); const html = renderToStaticMarkup(ReceiptView({ receipt: r, pdfUrl: "/pdf" })); assert.match(html, /Payment information recorded by the business/); assert.match(html, /Print receipt/); assert.match(html, /Download PDF/); assert.doesNotMatch(html, /<script>/); });
test("Stripe receipt includes processor URL separately", async () => { await stripePayment(); await processConnectEvent(event()); const r = await receipts.publicReceipt(tables.customerPayment[0].receiptToken); const html = renderToStaticMarkup(ReceiptView({ receipt: r, pdfUrl: "/pdf" })); assert.match(html, /View Stripe receipt/); assert.doesNotMatch(html, /not independently verified/); });
test("on-demand PDF generates with multiple lines and accented text", async () => { const id = await service.recordManualPayment("project", manual({ customerName: "José García", items: Array.from({ length: 30 }, () => ({ description: "Réparation ".repeat(20), quantity: 1, unitAmount: "1.00" })) })); const bytes = await receiptPdf(await receipts.ownerReceipt("project", id)); assert.equal(bytes.subarray(0, 5).toString(), "%PDF-"); assert.ok(bytes.length > 3000); });
test("receipt revoke disables old token while owner PDF remains accessible", async () => { const id = await service.recordManualPayment("project", manual()); const token = tables.customerPayment[0].receiptToken; await receipts.changeReceiptAccess("project", id, false); assert.equal(await receipts.publicReceipt(token), null); assert.ok(await receipts.ownerReceipt("project", id)); const response = await ownerPdf(new Request("https://launchsite.example/pdf"), { params: Promise.resolve({ id }) }); assert.equal(response.status, 200); assert.match(response.headers.get("content-type"), /application\/pdf/); });
test("receipt token PDF and unauthorized owner PDF reject unrelated access", async () => { const id = await service.recordManualPayment("project", manual()); actor.id = "other"; assert.equal((await ownerPdf(new Request("https://launchsite.example/pdf"), { params: Promise.resolve({ id }) })).status, 404); assert.equal((await publicPdf(new Request("https://launchsite.example/pdf"), { params: Promise.resolve({ token: "f".repeat(64) }) })).status, 404); });
test("owner email derives recipient and safely encodes business content", async () => { tables.websiteProject[0].businessName = "<b>Business</b>"; const id = await service.recordManualPayment("project", manual()); await receipts.emailReceipt("project", id); const e = calls.find((c) => c[0] === "email"); assert.deepEqual(e[1].to, ["customer@example.test"]); assert.match(e[1].html, /&lt;b&gt;/); assert.match(e[1].html, /not independently verified/); assert.match(e[2].idempotencyKey, /^receipt:/); });
test("unauthorized owner cannot email receipt", async () => { const id = await service.recordManualPayment("project", manual()); actor.id = "other"; await assert.rejects(receipts.emailReceipt("project", id)); assert.equal(calls.filter((c) => c[0] === "email").length, 0); });
test("email failure preserves transaction and receipt", async () => { const id = await service.recordManualPayment("project", manual()); failure = "email"; await assert.rejects(receipts.emailReceipt("project", id), /record is saved/); assert.equal(tables.customerPayment[0].paymentStatus, "PAID"); assert.ok(tables.customerPayment[0].receiptNumber); });
test("revoked access and missing recipient prevent email", async () => { const id = await service.recordManualPayment("project", manual({ customerEmail: "" })); await assert.rejects(receipts.emailReceipt("project", id), /no customer email/); await receipts.changeReceiptAccess("project", id, false); await assert.rejects(receipts.emailReceipt("project", id), /Enable receipt sharing/); });
test("rate limit blocks expensive payment operations", async () => { failure = "rate"; await assert.rejects(service.onboardConnect("project"), /Too many/); await assert.rejects(checkout(), /Too many/); });
test("external refund records do not call any processor; Stripe record cannot be manually refunded", async () => { const id = await service.recordManualPayment("project", manual()); await service.updateManualStatus("project", id, { status: "PARTIALLY_REFUNDED", refundedAmount: "1.00" }); assert.equal(tables.customerPayment[0].refundedAmount, 100); await service.updateManualStatus("project", id, { status: "REFUNDED" }); assert.equal(tables.customerPayment[0].refundedAmount, 2100); const p = await stripePayment(); await assert.rejects(service.updateManualStatus("project", p.id, { status: "REFUNDED" })); assert.equal(calls.filter((c) => /refund/.test(c[0])).length, 0); });
test("transactions query rejects another owner", async () => { actor.id = "other"; await assert.rejects(listPayments("project", {})); });
test("transaction filters, search and bounded pagination stay project scoped", async () => {
  await service.recordManualPayment("project", manual({ customerName: "Find Me" }));
  await service.recordManualPayment("project", manual({ customerName: "Do Not Find" }));
  tables.customerPayment.push({ ...copy(tables.customerPayment[0]), id: "other", projectId: "other-project" });
  const list = await listPayments("project", { q: "find me", method: "CASH", status: "PAID", from: "2000-01-01" });
  assert.equal(list.items.length, 1); assert.equal(list.items[0].customerName, "Find Me");
  assert.equal((await listPayments("project", { page: "9999999999" })).page, 10000);
});
test("payment offer editing enforces ownership and validates prices", async () => {
  await service.savePaymentItem("project", { id: "offer", name: "Edited", type: "FIXED", amount: "29.99", enabled: true });
  assert.equal(tables.paymentItem[0].amount, 2999);
  await assert.rejects(service.savePaymentItem("project", { id: "offer", name: "Bad", type: "FIXED", amount: "0.01", enabled: true }));
  actor.id = "other"; await assert.rejects(service.savePaymentItem("project", { id: "offer", name: "Bad", type: "FIXED", amount: "10.00", enabled: true }));
});
test("project dashboard renders guided forms and transaction history", async () => {
  await service.saveExternalOption("project", link);
  await service.recordManualPayment("project", manual());
  const Page = require("../src/app/(launchsite)/dashboard/projects/[id]/payments/page.tsx").default;
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "project" }), searchParams: Promise.resolve({}) }));
  assert.match(html, /External payment links/); assert.match(html, /Record a payment/); assert.match(html, /LS-000001/);
  assert.doesNotMatch(html, /acct_merchant|cus_saas|sub_saas/);
  if (process.env.PAYMENT_FIXTURE_PATH) {
    const path = require("node:path");
    const cssDir = ".next/static/chunks";
    const css = fs.readdirSync(cssDir).filter((name) => name.endsWith(".css")).map((name) => fs.readFileSync(path.join(cssDir, name), "utf8")).join("\n");
    fs.writeFileSync(process.env.PAYMENT_FIXTURE_PATH, `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body>${html}</body></html>`);
  }
});
test("migration is additive and leaves existing billing/data tables untouched", () => { const sql = fs.readFileSync("prisma/migrations/20260914160000_customer_payments/migration.sql", "utf8"); assert.doesNotMatch(sql, /\b(DROP|TRUNCATE|DELETE FROM)\b/i); assert.doesNotMatch(sql, /ALTER TABLE "(BillingAccount|WebsiteProject|Lead|Domain|AnalyticsEvent)"/); assert.match(sql, /UNIQUE INDEX "CustomerPayment_projectId_receiptNumber_key"/); assert.match(sql, /CustomerPayment_source_check/); });

test("Accounts v2 SDK uses official endpoints, JSON and the stable client version for all requests", async () => {
  const requests = [];
  const client = new Stripe("sk_test_local_mock", { apiVersion: "2026-08-26.dahlia", httpClient: Stripe.createFetchHttpClient(async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify(activeAccount()), { headers: { "content-type": "application/json" } });
  }) });
  await client.v2.core.accounts.create(merchantStripe.merchantAccountParams({ businessName: "Test Business", email: "business@example.test" }, "owner@example.test"), { idempotencyKey: "v2-test" });
  await merchantStripe.retrieveMerchantAccount("acct_merchant", undefined, client);
  await client.v2.core.accountLinks.create({ account: "acct_merchant", use_case: { type: "account_onboarding", account_onboarding: { configurations: ["merchant"], refresh_url: "https://launchsite.example/refresh", return_url: "https://launchsite.example/return" } } });
  assert.equal(new URL(requests[0].url).pathname, "/v2/core/accounts");
  for (const request of requests) assert.equal(new Headers(request.options.headers).get("stripe-version"), "2026-08-26.dahlia");
  assert.match(new Headers(requests[0].options.headers).get("content-type"), /application\/json/);
  assert.equal(JSON.parse(requests[0].options.body).configuration.merchant.capabilities.card_payments.requested, true);
  assert.match(requests[1].url, /include/);
  assert.equal(new URL(requests[2].url).pathname, "/v2/core/account_links");
});
test("hosted merchant-only onboarding and return refresh never imply active status", async () => {
  tables.projectPaymentSettings = [];
  const before = copy(tables.billingAccount);
  assert.match(await service.onboardConnect("project"), /^https:\/\/connect.stripe.com\//);
  assert.equal(tables.projectPaymentSettings[0].stripeConnectStatus, "PENDING");
  await service.refreshConnect("project");
  assert.equal(tables.projectPaymentSettings[0].stripeConnectStatus, "PENDING");
  assert.equal(tables.projectPaymentSettings[0].stripeChargesEnabled, false);
  const linkCall = calls.find((c) => c[0] === "account-link");
  assert.equal(linkCall[1].use_case.type, "account_onboarding");
  assert.deepEqual(linkCall[1].use_case.account_onboarding.configurations, ["merchant"]);
  assert.equal(linkCall[2], undefined);
  assert.equal(linkCall[1].use_case.account_onboarding.collection_options.fields, "currently_due");
  assert.deepEqual(tables.billingAccount, before);
});
test("v2 readiness uses exact card/payout capabilities and fails closed for missing data", () => {
  const ready = connectState(activeAccount());
  assert.equal(ready.stripeChargesEnabled, true); assert.equal(ready.stripePayoutsEnabled, true);
  const noPayouts = connectState(activeAccount({ payoutStatus: "restricted" }));
  assert.equal(noPayouts.stripeConnectStatus, "ACTIVE"); assert.equal(noPayouts.stripePayoutsEnabled, false);
  for (const cardStatus of ["pending", "restricted", "unsupported", "unknown"]) assert.equal(connectState(activeAccount({ cardStatus })).stripeChargesEnabled, false);
  assert.equal(connectState(activeAccount({ configuration: undefined })).stripeChargesEnabled, false);
  assert.equal(connectState(activeAccount({ defaults: undefined })).stripeChargesEnabled, false);
  assert.equal(connectState(activeAccount({ closed: true })).stripePayoutsEnabled, false);
  assert.equal(connectState(activeAccount({ defaults: { responsibilities: { fees_collector: "application", losses_collector: "application" } } })).stripeConnectStatus, "RESTRICTED");
});
test("retained details-submitted field distinguishes user requirements from Stripe verification", () => {
  assert.equal(connectState(activeAccount({ requirements: { entries: [userRequirement()] } })).stripeDetailsSubmitted, false);
  assert.equal(connectState(activeAccount({ requirements: { entries: [userRequirement("eventually_due")] } })).stripeDetailsSubmitted, true);
  assert.equal(connectState(activeAccount({ requirements: undefined })).stripeDetailsSubmitted, false);
  const pending = connectState(activeAccount({ cardStatus: "pending", requirements: { entries: [{ ...userRequirement(), awaiting_action_from: "stripe" }] } }));
  assert.equal(pending.stripeDetailsSubmitted, true); assert.equal(pending.stripeConnectStatus, "PENDING");
});
async function deliverThin(payload, secret = process.env.STRIPE_CONNECT_ACCOUNTS_WEBHOOK_SECRET, query = "?events=accounts") {
  const body = JSON.stringify(payload);
  const signature = realStripe.webhooks.generateTestHeaderString({ payload: body, secret });
  return webhook(new Request(`https://launchsite.example/api/stripe/connect/webhook${query}`, { method: "POST", headers: { "stripe-signature": signature }, body }));
}
test("both Connect webhook destinations work without the SaaS credential", async () => {
  delete process.env.STRIPE_SECRET_KEY;
  const payment = await stripePayment();
  const before = copy(tables.billingAccount);
  assert.equal((await deliverThin(thinEvent())).status, 200);
  assert.equal((await deliverThin(event("checkout.session.completed", payment), process.env.STRIPE_CONNECT_WEBHOOK_SECRET, "")).status, 200);
  assert.deepEqual(tables.billingAccount, before);
});

test("both Connect webhook destinations fail safely without the dedicated credential even when billing is configured", async () => {
  for (const key of [undefined, "", "   "]) {
    if (key === undefined) delete process.env.STRIPE_CONNECT_SECRET_KEY;
    else process.env.STRIPE_CONNECT_SECRET_KEY = key;
    for (const query of ["", "?events=accounts"]) {
      const response = await webhook(new Request(`https://launchsite.example/api/stripe/connect/webhook${query}`, { method: "POST", body: "{}" }));
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: "Connect is not configured." });
    }
  }
  assert.equal(calls.length, 0);
});

test("signed thin notification refreshes only mapped account and preserves signed context", async () => {
  accounts.set("acct_merchant", activeAccount({ payoutStatus: "pending" }));
  const before = copy(tables.billingAccount);
  const response = await deliverThin(thinEvent(undefined, { context: "acct_merchant" }));
  assert.equal(response.status, 200);
  const call = calls.find((c) => c[0] === "account-retrieve");
  assert.equal(call[1], "acct_merchant");
  assert.deepEqual(call[2].include, ["configuration.merchant", "requirements", "defaults"]);
  assert.equal(call[3].stripeContext.toString(), "acct_merchant");
  assert.equal(tables.projectPaymentSettings[0].stripePayoutsEnabled, false);
  assert.deepEqual(tables.billingAccount, before);
  assert.equal(tables.customerPayment.length, 0);
});
test("thin webhook signature and destination secrets cannot be interchanged", async () => {
  assert.equal((await deliverThin(thinEvent(), "whsec_wrong")).status, 400);
  assert.equal((await deliverThin(thinEvent(), process.env.STRIPE_CONNECT_WEBHOOK_SECRET)).status, 400);
  assert.equal((await deliverThin(thinEvent(), process.env.STRIPE_CONNECT_ACCOUNTS_WEBHOOK_SECRET, "")).status, 400);
  assert.equal((await deliverThin(thinEvent(), process.env.STRIPE_CONNECT_WEBHOOK_SECRET, "")).status, 400);
  delete process.env.STRIPE_CONNECT_ACCOUNTS_WEBHOOK_SECRET;
  assert.equal((await deliverThin(thinEvent(), "whsec_test")).status, 503);
});
test("duplicate thin notifications are idempotent and stale events use current closed state", async () => {
  const notification = thinEvent();
  await Promise.all([processConnectAccountEvent(notification), processConnectAccountEvent(notification)]);
  assert.equal(tables.connectWebhookEvent.length, 1);
  assert.equal(calls.filter((c) => c[0] === "account-retrieve").length, 1);
  accounts.set("acct_merchant", activeAccount({ closed: true }));
  await processConnectAccountEvent(thinEvent("v2.core.account.closed"));
  await processConnectAccountEvent(thinEvent("v2.core.account[configuration.merchant].capability_status_updated"));
  assert.equal(tables.projectPaymentSettings[0].stripeConnectStatus, "DISABLED");
  assert.equal(tables.projectPaymentSettings[0].stripeChargesEnabled, false);
});
test("thin account synchronization failure rolls back and can be retried", async () => {
  const notification = thinEvent();
  accounts.set("acct_merchant", activeAccount({ cardStatus: "restricted" }));
  failure = "event-write";
  await assert.rejects(processConnectAccountEvent(notification));
  assert.equal(tables.projectPaymentSettings[0].stripeConnectStatus, "ACTIVE");
  assert.equal(tables.connectWebhookEvent.length, 0);
  failure = null;
  await processConnectAccountEvent(notification);
  assert.equal(tables.projectPaymentSettings[0].stripeConnectStatus, "RESTRICTED");
});
test("unmapped thin account is ignored, unrelated object rejected, and resource URL never fetched", async () => {
  await processConnectAccountEvent(thinEvent(undefined, { related_object: { id: "acct_other", type: "v2.core.account", url: "https://evil.test" } }));
  assert.equal(calls.length, 0);
  await assert.rejects(processConnectAccountEvent(thinEvent(undefined, { related_object: { id: "acct_merchant", type: "v2.core.account_link", url: "https://evil.test" } })));
  await processConnectAccountEvent(thinEvent(undefined, { related_object: { id: "acct_merchant", type: "v2.core.account", url: "https://evil.test" } }));
  assert.equal(calls.find((c) => c[0] === "account-retrieve")[1], "acct_merchant");
});
test("legacy lifecycle snapshots no longer drive readiness", async () => {
  accounts.set("acct_merchant", activeAccount({ cardStatus: "restricted" }));
  await processConnectEvent(event("account.updated", {}, { data: { object: { id: "acct_merchant" } } }));
  assert.equal(calls.length, 0); assert.equal(tables.projectPaymentSettings[0].stripeConnectStatus, "ACTIVE");
});
