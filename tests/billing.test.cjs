/* eslint-disable @typescript-eslint/no-require-imports -- Test doubles precede server imports. */
const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const Stripe = require("stripe");
const realStripe = new Stripe("sk_test_unit_test_only");
const authPath = require.resolve("../src/auth.ts");
const prismaPath = require.resolve("../src/lib/prisma.ts");
const stripePath = require.resolve("../src/lib/billing/stripe.ts");
let actor, accounts, projects, events, customers, subscriptions, sessions, calls, failure;
let transactionTail = Promise.resolve();
const copy = (value) => value == null ? value : structuredClone(value);
const values = (main, staged) => [...new Map([...main, ...staged]).values()];
function billingRow(userId, extra = {}) {
  return { id: `ba_${userId}`, userId, plan: "FREE", stripeCustomerId: null, stripeSubscriptionId: null, stripePriceId: null, subscriptionStatus: null, subscriptionCreatedAt: null, currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, checkoutSessionId: null, checkoutAttemptId: null, checkoutPlan: null, checkoutPriceId: null, checkoutExpiresAt: null, createdAt: new Date(), updatedAt: new Date(), ...extra };
}
function site(id, userId = "a", extra = {}) {
  return { id, userId, slug: `internal-${id}`, businessName: `Test ${id}`, businessType: "Home services", businessDescription: "Factual business description", serviceArea: "Tulsa", phone: "918-555-0100", email: "business@example.test", yearsInBusiness: null, brandTone: "Warm and welcoming", primaryCallToAction: "Get in touch", visualStyle: "Modern", status: "DRAFT", createdAt: new Date(), updatedAt: new Date(), isDemo: false, isPublished: false, publicSlug: null, publishedAt: null, lastPublishedAt: null, factualNotes: "", services: [{ name: "Service", description: "Factual service", notes: null, position: 0 }], workSamples: [], testimonials: [], generatedContent: null, siteSettings: null, ...extra };
}
function subscription(id = "sub_a", extra = {}) {
  return { id, object: "subscription", customer: "cus_a", created: 1000, status: "active", cancel_at_period_end: false, metadata: { launchsiteUserId: "a", launchsitePlan: "STARTER", launchsiteBaseSubscription: "true" }, items: { data: [{ id: "si_a", quantity: 1, current_period_start: 1000, current_period_end: 2000, price: { id: "price_starter" } }], has_more: false }, ...extra };
}
function client(stagedAccounts = null, stagedProjects = null, stagedEvents = null) {
  const aRows = () => values(accounts, stagedAccounts ?? new Map());
  const pRows = () => values(projects, stagedProjects ?? new Map());
  const findAccount = (where) => aRows().find((row) => Object.entries(where).every(([k, v]) => row[k] === v));
  return {
    $queryRaw: async (strings, key) => { assert.match(strings.join(""), /pg_advisory_xact_lock/); assert.match(key, /^billing:/); calls.push(["lock", key]); return []; },
    user: { findUnique: async ({ where }) => where.email ? actor : ["a", "b", "admin"].includes(where.id) ? { id: where.id, role: where.id === "admin" ? "ADMIN" : "USER" } : null },
    billingAccount: {
      findUnique: async ({ where }) => copy(findAccount(where) ?? null),
      upsert: async ({ where, create, update }) => {
        const old = findAccount(where);
        const row = old ? { ...old, ...update } : billingRow(create.userId, create);
        (stagedAccounts ?? accounts).set(row.userId, copy(row)); return copy(row);
      },
      update: async ({ where, data }) => {
        if (failure === "persist-session" && data.checkoutSessionId) { failure = null; throw new Error("test DB interruption"); }
        const old = findAccount(where); assert.ok(old);
        const row = { ...old, ...data }; (stagedAccounts ?? accounts).set(row.userId, copy(row)); return copy(row);
      },
    },
    stripeWebhookEvent: {
      findUnique: async ({ where }) => copy((stagedEvents?.get(where.eventId) ?? events.get(where.eventId)) || null),
      create: async ({ data }) => {
        if (failure === "event-write") { failure = null; throw new Error("test event transaction failure"); }
        assert.ok(!events.has(data.eventId)); (stagedEvents ?? events).set(data.eventId, data); return data;
      },
    },
    websiteProject: {
      findUnique: async ({ where }) => copy(pRows().find((row) => row.id === where.id) ?? null),
      findFirst: async ({ where }) => copy(pRows().find((row) => (!where.publicSlug || row.publicSlug === where.publicSlug) && (where.isPublished === undefined || row.isPublished === where.isPublished) && (!where.NOT || row.id !== where.NOT.id)) ?? null),
      count: async ({ where }) => pRows().filter((row) => row.userId === where.userId && row.isPublished === where.isPublished).length,
      update: async ({ where, data }) => { const row = { ...pRows().find((row) => row.id === where.id), ...data }; (stagedProjects ?? projects).set(row.id, row); return copy(row); },
    },
  };
}
const db = client();
db.$transaction = async (work) => {
  const before = transactionTail;
  let unlock;
  transactionTail = new Promise((resolve) => { unlock = resolve; });
  await before;
  const a = new Map(), p = new Map(), e = new Map();
  try {
    const result = await work(client(a, p, e));
    for (const [key, value] of a) accounts.set(key, value);
    for (const [key, value] of p) projects.set(key, value);
    for (const [key, value] of e) events.set(key, value);
    return result;
  } finally { unlock(); }
};
async function* listed(map, predicate = () => true) { for (const row of map.values()) if (predicate(row)) yield copy(row); }
const stripe = {
  customers: {
    search: async () => { calls.push(["customer-search"]); return { data: [...customers.values()].filter((c) => c.metadata.launchsiteUserId === actor.id) }; },
    create: async (params, options) => { calls.push(["customer-create", params, options]); const row = { id: `cus_${actor.id}`, ...params }; customers.set(row.id, row); return copy(row); },
    retrieve: async (id) => { calls.push(["customer-retrieve", id]); assert.ok(customers.has(id)); return copy(customers.get(id)); },
  },
  subscriptions: {
    list: ({ customer }) => { calls.push(["subscription-list", customer]); return listed(subscriptions, (row) => row.customer === customer); },
    retrieve: async (id) => { calls.push(["subscription-retrieve", id]); if (!subscriptions.has(id)) throw { code: "resource_missing" }; return copy(subscriptions.get(id)); },
  },
  subscriptionItems: { list: () => listed(new Map()) },
  prices: { retrieve: async (id) => { calls.push(["price-retrieve", id]); return { id, active: true, currency: "usd", unit_amount: id === "price_starter" ? 1900 : 3900, recurring: { interval: "month", interval_count: 1, usage_type: "licensed" } }; } },
  checkout: { sessions: {
    create: async (params, options) => {
      calls.push(["checkout-create", params, options]);
      const row = { id: `cs_${sessions.size + 1}`, url: `https://checkout.stripe.com/test-${sessions.size + 1}`, status: "open", ...params };
      sessions.set(row.id, row);
      if (failure === "stripe-response") { failure = null; throw new Error("test lost Stripe response"); }
      return copy(row);
    },
    list: ({ customer }) => listed(sessions, (row) => row.customer === customer),
    retrieve: async (id) => { assert.ok(sessions.has(id)); return copy(sessions.get(id)); },
    expire: async (id) => { calls.push(["checkout-expire", id]); const row = sessions.get(id); if (row.status !== "open") throw new Error("Already complete"); row.status = "expired"; return copy(row); },
  } },
  billingPortal: { sessions: { create: async (params) => { calls.push(["portal-create", params]); return { url: "https://billing.stripe.com/unit-test" }; } } },
  webhooks: realStripe.webhooks,
};
const stub = (id, exports) => { require.cache[id] = { id, filename: id, loaded: true, exports }; };
stub(prismaPath, { prisma: db });
stub(authPath, { auth: async () => actor ? { user: { email: `${actor.id}@example.test` } } : null });
stub(stripePath, { getStripe: () => stripe });
stub(require.resolve("next/cache"), { revalidatePath: () => {} });
const { createCheckout, createBillingPortal } = require("../src/lib/billing/checkout.ts");
const { getUserEntitlements } = require("../src/lib/billing/entitlements.ts");
const { processStripeEvent } = require("../src/lib/billing/webhooks.ts");
const { normalizeSubscription } = require("../src/lib/billing/subscription.ts");
const { getPriceIds } = require("../src/lib/billing/config.ts");
const { POST } = require("../src/app/api/stripe/webhook/route.ts");
const { publishProject, unpublishProject, getPublicProject } = require("../src/lib/project-repository.ts");
const { publishProjectAction } = require("../src/app/actions/projects.ts");
const { startCheckoutAction } = require("../src/app/actions/billing.ts");
const { plans } = require("../src/lib/billing/plans.ts");
const { getAppUrl } = require("../src/lib/app-url.ts");

beforeEach(() => {
  actor = { id: "a", role: "USER" };
  accounts = new Map(); projects = new Map([["one", site("one")], ["two", site("two")]]); events = new Map();
  customers = new Map(); subscriptions = new Map(); sessions = new Map(); calls = []; failure = null;
  process.env.ADMIN_EMAILS = ""; process.env.STRIPE_STARTER_PRICE_ID = "price_starter"; process.env.STRIPE_BUSINESS_PRICE_ID = "price_business"; process.env.STRIPE_WEBHOOK_SECRET = "whsec_unit_test_only"; process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
});
function paid(plan = "STARTER", status = "active") { accounts.set("a", billingRow("a", { plan, subscriptionStatus: status, stripeCustomerId: "cus_a", stripeSubscriptionId: "sub_a" })); }
function event(id, type = "customer.subscription.updated", sub = subscription()) { return { id, type, object: "event", created: 1000, data: { object: sub } }; }

test("no billing record is Free; publish action returns an upgrade code", async () => {
  assert.equal((await getUserEntitlements("a")).plan, "FREE");
  const result = await publishProjectAction("one");
  assert.equal(result.ok, false); assert.equal(result.code, "PUBLISH_REQUIRES_PAID_PLAN"); assert.equal(projects.get("one").isPublished, false);
});
test("paid statuses and cancellation policy are centralized; unknown statuses fail closed", async () => {
  for (const plan of ["STARTER", "BUSINESS"]) {
    for (const status of ["active", "trialing", "past_due"]) { paid(plan, status); accounts.get("a").cancelAtPeriodEnd = true; assert.equal((await getUserEntitlements("a")).canPublish, true); }
    for (const status of ["incomplete", "incomplete_expired", "canceled", "unpaid", "paused", "future_status"]) { paid(plan, status); assert.equal((await getUserEntitlements("a")).canPublish, false); await assert.rejects(publishProject("one"), { code: "PUBLISH_REQUIRES_PAID_PLAN" }); }
  }
});
test("Starter limits are atomic for concurrent publishes; existing over-limit sites can be republished", async () => {
  paid();
  const results = await Promise.allSettled([publishProject("one"), publishProject("two")]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.find((r) => r.status === "rejected").reason.code, "PUBLISHED_SITE_LIMIT_REACHED");
  projects.get("two").isPublished = true;
  await publishProject("one");
  projects.set("three", site("three"));
  await assert.rejects(publishProject("three"), { code: "PUBLISHED_SITE_LIMIT_REACHED" });
});
test("Business allows its configured site limit", async () => {
  paid("BUSINESS");
  for (let index = 0; index < plans.BUSINESS.maxPublishedSites; index++) { projects.set(`b${index}`, site(`b${index}`)); await publishProject(`b${index}`); }
  await assert.rejects(publishProject("one"), { code: "PUBLISHED_SITE_LIMIT_REACHED" });
});
test("billing cannot bypass ownership; only trusted admin/demo behavior bypasses payment", async () => {
  paid("BUSINESS"); actor = { id: "b", role: "USER" };
  await assert.rejects(publishProject("one"), /NOT_FOUND/);
  actor = { id: "admin", role: "ADMIN" };
  await assert.rejects(publishProject("one"), /NOT_FOUND/);
  projects.get("one").isDemo = true; await publishProject("one");
  actor = { id: "a", role: "USER" }; accounts.clear();
  await assert.rejects(publishProject("one"), { code: "PUBLISH_REQUIRES_PAID_PLAN" });
});
test("Free historical public site still renders without Stripe; unpublish remains allowed", async () => {
  projects.get("one").isPublished = true; projects.get("one").publicSlug = "historic-site";
  actor = null; assert.ok(await getPublicProject("historic-site")); assert.deepEqual(calls, []);
  actor = { id: "a", role: "USER" }; await unpublishProject("one"); assert.equal(await getPublicProject("historic-site"), null);
  await assert.rejects(publishProject("one"), { code: "PUBLISH_REQUIRES_PAID_PLAN" });
});
test("Checkout accepts application plans only, with authenticated identity", async () => {
  for (const plan of ["FREE", "price_business", { plan: "BUSINESS", userId: "b" }, null, "unknown"]) await assert.rejects(createCheckout(plan), { code: "INVALID_PLAN" });
  actor = null; await assert.rejects(createCheckout("STARTER"), /UNAUTHENTICATED/); assert.equal(calls.length, 0);
});
test("Checkout reuses one customer and open session, including concurrent requests", async () => {
  const [a, b] = await Promise.all([createCheckout("STARTER"), createCheckout("STARTER")]);
  assert.equal(a, b); assert.equal(calls.filter(([kind]) => kind === "customer-create").length, 1); assert.equal(calls.filter(([kind]) => kind === "checkout-create").length, 1);
  const [, params] = calls.find(([kind]) => kind === "checkout-create");
  assert.equal(params.mode, "subscription"); assert.deepEqual(params.line_items, [{ price: "price_starter", quantity: 1 }]); assert.equal(params.customer, "cus_a"); assert.equal(params.subscription_data.metadata.launchsiteUserId, "a");
  assert.equal((await getUserEntitlements("a")).plan, "FREE", "creating Checkout cannot grant access");
});
test("Checkout recovery persists the attempt before an interrupted external call or DB write", async () => {
  for (const interruption of ["stripe-response", "persist-session"]) {
    accounts.clear(); customers.clear(); sessions.clear(); calls.length = 0; failure = interruption;
    await assert.rejects(createCheckout("STARTER"));
    assert.ok(accounts.get("a").checkoutAttemptId);
    assert.match(await createCheckout("STARTER"), /checkout.stripe.com/);
    assert.equal(calls.filter(([kind]) => kind === "checkout-create").length, 1);
  }
});
test("switching Checkout plans expires the prior open session", async () => {
  await createCheckout("STARTER"); await createCheckout("BUSINESS");
  assert.equal(sessions.get("cs_1").status, "expired"); assert.equal(sessions.get("cs_2").line_items[0].price, "price_business");
});
test("paid and unfinished subscriptions use the portal; pending webhooks cannot cause duplicates", async () => {
  for (const status of ["active", "trialing", "past_due", "incomplete", "unpaid", "paused"]) {
    paid("STARTER", status); assert.match(await createCheckout("BUSINESS"), /billing.stripe.com/);
  }
  accounts.set("a", billingRow("a", { stripeCustomerId: "cus_a" })); subscriptions.set("sub_a", subscription());
  assert.match(await createCheckout("STARTER"), /billing.stripe.com/); assert.equal(calls.filter(([kind]) => kind === "checkout-create").length, 0);
});
test("canceled subscriptions can start again despite an old completed Checkout", async () => {
  paid("STARTER", "canceled"); accounts.get("a").checkoutSessionId = "cs_old";
  subscriptions.set("sub_a", subscription("sub_a", { status: "canceled" }));
  sessions.set("cs_old", { id: "cs_old", customer: "cus_a", status: "complete", subscription: "sub_a" });
  assert.match(await createCheckout("STARTER"), /checkout.stripe.com/);
});
test("Billing Portal uses only the authenticated user's stored customer", async () => {
  accounts.set("a", billingRow("a", { stripeCustomerId: "cus_a" })); accounts.set("b", billingRow("b", { stripeCustomerId: "cus_b" }));
  await createBillingPortal("cus_b", "b");
  assert.equal(calls.find(([kind]) => kind === "portal-create")[1].customer, "cus_a");
  actor = null; await assert.rejects(createBillingPortal(), /UNAUTHENTICATED/);
});
test("missing/ambiguous price configuration fails gracefully", async () => {
  delete process.env.STRIPE_STARTER_PRICE_ID;
  const result = await startCheckoutAction("STARTER"); assert.equal(result.ok, false); assert.match(result.error, /not configured/);
  process.env.STRIPE_STARTER_PRICE_ID = "price_business"; assert.throws(getPriceIds, { code: "BILLING_NOT_CONFIGURED" });
});
test("subscription items, not metadata or first item, determine the base plan", () => {
  const sub = subscription(); sub.metadata.launchsitePlan = "BUSINESS";
  assert.equal(normalizeSubscription(sub, getPriceIds()).plan, "STARTER");
  sub.items.data.unshift({ quantity: 1, price: { id: "price_future_addon" } });
  assert.equal(normalizeSubscription(sub, getPriceIds()).plan, "STARTER");
  sub.items.data[1].price.id = "price_unknown"; assert.equal(normalizeSubscription(sub, getPriceIds()).plan, "FREE");
  sub.items.data = [{ quantity: 1, price: { id: "price_starter" } }, { quantity: 1, price: { id: "price_business" } }]; assert.equal(normalizeSubscription(sub, getPriceIds()).plan, "FREE");
});
test("webhooks atomically synchronize current state once, even with duplicate concurrent deliveries", async () => {
  accounts.set("a", billingRow("a", { stripeCustomerId: "cus_a" })); subscriptions.set("sub_a", subscription());
  await Promise.all([processStripeEvent(event("evt_1")), processStripeEvent(event("evt_1"))]);
  assert.equal(events.size, 1); assert.equal((await getUserEntitlements("a")).plan, "STARTER");
  assert.equal(calls.filter(([kind]) => kind === "subscription-retrieve").length, 1);
  subscriptions.get("sub_a").status = "canceled";
  await processStripeEvent(event("evt_old_snapshot", "customer.subscription.updated"));
  assert.equal((await getUserEntitlements("a")).plan, "FREE", "old event fetches current Stripe state");
});
test("failed webhook transaction records neither success nor partial billing, allowing retry", async () => {
  accounts.set("a", billingRow("a", { stripeCustomerId: "cus_a" })); subscriptions.set("sub_a", subscription()); failure = "event-write";
  await assert.rejects(processStripeEvent(event("evt_retry"))); assert.equal(events.size, 0); assert.equal(accounts.get("a").plan, "FREE");
  await processStripeEvent(event("evt_retry")); assert.equal(accounts.get("a").plan, "STARTER");
});
test("old subscription deletion cannot revoke a newer paid subscription", async () => {
  paid(); accounts.get("a").stripeSubscriptionId = "sub_new"; accounts.get("a").subscriptionCreatedAt = new Date(3000 * 1000);
  subscriptions.set("sub_a", subscription("sub_a", { status: "canceled" }));
  await processStripeEvent(event("evt_old_deleted", "customer.subscription.deleted", subscriptions.get("sub_a")));
  assert.equal(accounts.get("a").stripeSubscriptionId, "sub_new"); assert.equal((await getUserEntitlements("a")).canPublish, true);
});
test("Checkout completed reconciles via subscription, without trusting a claimed plan", async () => {
  accounts.set("a", billingRow("a", { stripeCustomerId: "cus_a" })); subscriptions.set("sub_a", subscription());
  const e = event("evt_checkout", "checkout.session.completed", { mode: "subscription", customer: "cus_a", subscription: "sub_a", metadata: { launchsitePlan: "BUSINESS", launchsiteUserId: "b" } });
  await processStripeEvent(e); assert.equal(accounts.get("a").plan, "STARTER"); assert.equal(accounts.has("b"), false);
});
test("deleted subscription removes future publishing access but preserves sites and data", async () => {
  paid(); projects.get("one").isPublished = true; projects.get("one").publicSlug = "historic-site";
  subscriptions.set("sub_a", subscription("sub_a", { status: "canceled" }));
  await processStripeEvent(event("evt_deleted", "customer.subscription.deleted", subscriptions.get("sub_a")));
  assert.equal((await getUserEntitlements("a")).canPublish, false); assert.ok(await getPublicProject("historic-site")); assert.equal(projects.size, 2);
});
test("webhook signature verification uses the exact raw body and rejects invalid signatures", async () => {
  const payload = JSON.stringify(event("evt_unsupported", "test.unsupported"));
  const signature = realStripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  assert.equal((await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload }))).status, 400);
  assert.equal((await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload + " ", headers: { "stripe-signature": signature } }))).status, 400);
  assert.equal((await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } }))).status, 200);
  assert.equal((await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "x".repeat(1_000_001), headers: { "stripe-signature": signature } }))).status, 413);
});

test("billing UI shows local status and never grants access from the success URL", async () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const BillingPage = require("../src/app/(launchsite)/account/billing/page.tsx").default;
  const PricingPage = require("../src/app/(launchsite)/pricing/page.tsx").default;
  let html = renderToStaticMarkup(await BillingPage({ searchParams: Promise.resolve({ checkout: "success" }) }));
  assert.match(html, /confirming your subscription/);
  assert.match(html, /Build, edit, and preview for free/);
  assert.equal(accounts.size, 0);
  paid(); accounts.get("a").cancelAtPeriodEnd = true; accounts.get("a").currentPeriodEnd = new Date("2030-01-01T00:00:00Z");
  html = renderToStaticMarkup(await BillingPage({ searchParams: Promise.resolve({}) }));
  assert.match(html, /Cancellation scheduled/); assert.match(html, /January 1, 2030/); assert.match(html, /Manage billing/);
  accounts.get("a").subscriptionStatus = "past_due";
  html = renderToStaticMarkup(await BillingPage({ searchParams: Promise.resolve({}) }));
  assert.match(html, /latest payment is overdue/);
  html = renderToStaticMarkup(React.createElement(React.Fragment, null, await PricingPage({ searchParams: Promise.resolve({}) })));
  assert.match(html, /Manage billing/); assert.doesNotMatch(html, /Choose Starter|Choose Business/);
});

test("admin Stripe returns always use the canonical production origin", async () => {
  actor = { id: "admin", role: "ADMIN" };
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_APP_URL = "https://launchsite-two.vercel.app/";
  process.env.VERCEL_URL = "launchsite-m4cu4kfpw-mauro-dot.vercel.app";
  accounts.clear(); customers.clear(); sessions.clear(); calls.length = 0;

  await createCheckout("STARTER");
  const checkout = calls.find(([kind]) => kind === "checkout-create")[1];
  assert.equal(getAppUrl(), "https://launchsite-two.vercel.app");
  assert.equal(checkout.success_url, "https://launchsite-two.vercel.app/account/billing?checkout=success");
  assert.equal(checkout.cancel_url, "https://launchsite-two.vercel.app/pricing?checkout=canceled");

  accounts.set("admin", billingRow("admin", { stripeCustomerId: "cus_admin" }));
  customers.set("cus_admin", { id: "cus_admin", metadata: { launchsiteUserId: "admin" } });
  calls.length = 0;
  await createBillingPortal();
  const portal = calls.find(([kind]) => kind === "portal-create")[1];
  assert.equal(portal.return_url, "https://launchsite-two.vercel.app/account/billing");
});

test("production ignores a deployment host when the canonical URL variable is missing", () => {
  process.env.NODE_ENV = "production";
  delete process.env.NEXT_PUBLIC_APP_URL;
  process.env.VERCEL_URL = "launchsite-preview-123.vercel.app";
  assert.equal(getAppUrl(), "https://launchsite-two.vercel.app");
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
});
