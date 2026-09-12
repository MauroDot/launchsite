# Task 011: Stripe plans and billing

## Architecture

LaunchSite uses Stripe as the payment authority and PostgreSQL as the application authorization source. Stripe Checkout creates subscriptions; signed webhook events retrieve the current Stripe subscription and synchronize one local `BillingAccount`. Feature code reads `getUserEntitlements()` and does not call Stripe to decide whether a user may publish. This keeps requests predictable and means the success redirect never grants access.

The plans are centralized in `src/lib/billing/plans.ts`:

| Plan | Price | Publish entitlement |
| --- | ---: | --- |
| Free | $0 | 0 new published sites; building, AI content, editing, and preview remain available |
| Starter | $19/month | 1 published site |
| Business | $39/month | 3 published sites |

Active, trialing, and past-due subscriptions grant paid access. Past-due access remains available while Stripe retries payment. Incomplete, incomplete-expired, canceled, unpaid, paused, unknown, or missing subscriptions fail closed. `cancelAtPeriodEnd` changes the displayed renewal state; it does not revoke access before Stripe reports a terminal status.

The publishing mutation takes the existing ownership/demo authorization path first, then acquires a PostgreSQL transaction advisory lock per user, resolves local entitlements, counts published projects, and writes the existing publication state. Starter and Business limits therefore apply server-side and remain atomic under concurrent requests. A site that is already published can be republished while an account is over a limit. Administrators retain access only for existing official demo projects; there is no global billing bypass.

Checkout accepts only `STARTER` or `BUSINESS` as an application plan. The server maps those values to environment-configured Price IDs, validates the retrieved Stripe Price is active USD monthly at the configured amount, creates/reuses one metadata-linked Stripe Customer, and uses Stripe idempotency keys. A local checkout attempt/session is recorded before the external call so retries can recover after timeouts or a failed local write. Active or unfinished base subscriptions are sent to the Billing Portal instead of creating duplicate subscriptions; old terminal subscriptions can be replaced.

The webhook at `/api/stripe/webhook` verifies the exact raw request body and `Stripe-Signature`. It handles `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`; other event types are acknowledged without mutation. The handler retrieves the current subscription inside the per-user lock because Stripe does not guarantee event order. Base plan is determined by the configured Price actually present on the subscription; metadata alone cannot grant Business. Unknown/add-on-only prices fail closed. `StripeWebhookEvent.eventId` and a transaction make duplicate delivery safe and prevent partial billing updates.

The Billing Portal endpoint is server-only and creates a short-lived session from the authenticated user’s stored `stripeCustomerId`. It never accepts a customer ID from the browser. Account billing displays the local plan, normalized status, period end, scheduled cancellation, past-due warnings, and Manage Billing. Pricing displays Free, Starter, and Business and routes signed-out users to sign-in. The checkout success message says LaunchSite is confirming the subscription; it does not assume webhook delivery has completed.

Existing published sites are deliberately independent of billing. The public `/site/[slug]` route still checks only the existing published/public slug state. No Free account is automatically unpublished, and subscription deletion preserves sites, content, media metadata, demos, and public rendering. Unpublish remains an existing owner/admin action and is not blocked by billing.

## Files

Added:

- `prisma/migrations/20260913090000_stripe_billing/migration.sql`
- `src/lib/billing/{plans,policy,errors,config,stripe,lock,entitlements,checkout,subscription,webhooks}.ts`
- `src/lib/app-url.ts`
- `src/app/actions/billing.ts`
- `src/app/api/stripe/webhook/route.ts`
- `src/components/billing-button.tsx`
- `src/app/(launchsite)/pricing/page.tsx`
- `src/app/(launchsite)/account/billing/{page,error}.tsx`
- `tests/billing.test.cjs`

Modified:

- `prisma/schema.prisma`
- `package.json` and `package-lock.json` (`stripe`, `server-only`)
- `.env.example`
- existing layout, account, login, header/footer, publishing action, browser smoke test, and TypeScript test loader files

## Database and migration safety

The schema adds `BillingPlan`, nullable billing fields through a one-to-one `BillingAccount`, and `StripeWebhookEvent`. Existing users do not receive billing rows until needed; missing rows resolve to Free. The migration creates only the enum, two billing tables, indexes, and the BillingAccount foreign key. It does not alter or recreate User, WebsiteProject, publishing fields, media tables, or FeaturedBusiness.

Migration: `20260913090000_stripe_billing`.

Before applying it, the existing database contained 2 users, 11 projects, 1 published project, and 2 demos. A before/after SHA-256 snapshot of all users and projects (including services, work samples, testimonials, FeaturedBusiness records, and publication fields) matched exactly. The database now has zero BillingAccount rows, as expected. No reset, destructive `db push`, table drop, data deletion, or migration replacement was used.

## Environment variables

Add these server-only values to the uncommitted `.env` file and deployment environment. They are documented in `.env.example`:

```env
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_STARTER_PRICE_ID="price_..."
STRIPE_BUSINESS_PRICE_ID="price_..."
```

Use test-mode keys and Price IDs locally. Never prefix these variables with `NEXT_PUBLIC_`. `NEXT_PUBLIC_APP_URL` remains the single canonical application-origin setting and is used for Checkout return URLs, Billing Portal return URLs, canonical metadata, and Open Graph URLs.

Without Stripe configuration, LaunchSite continues to run; pricing and billing actions return a friendly configuration message, while Free users can continue building and previewing.

## Stripe Dashboard setup

Use Test mode first. Do not substitute the placeholders below with guessed values.

1. Create a product named **LaunchSite Starter**.
2. Add a recurring monthly USD Price for $19. Copy its real `price_...` ID into `STRIPE_STARTER_PRICE_ID`.
3. Create a product named **LaunchSite Business**.
4. Add a recurring monthly USD Price for $39. Copy its real `price_...` ID into `STRIPE_BUSINESS_PRICE_ID`.
5. Open Billing → Customer portal and activate/configure it. Allow customers to update payment methods, view invoices, and cancel subscriptions. The application creates portal sessions on demand, so no portal URL is stored.
6. Create a webhook endpoint at `https://YOUR_DEPLOYED_HOST/api/stripe/webhook`. Copy the endpoint signing secret beginning `whsec_` into `STRIPE_WEBHOOK_SECRET`.
7. Subscribe the endpoint to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`. Invoice events can be added later; subscription state is refreshed from Stripe on the subscription events.
8. Copy the account’s test secret key beginning `sk_test_` into `STRIPE_SECRET_KEY`. Keep it only in local/Vercel environment settings.
9. Set `NEXT_PUBLIC_APP_URL` to the exact deployed origin, with no path, query string, or trailing slash.
10. Deploy, then run `npx.cmd prisma migrate deploy` as part of the deployment process. The checked database already has the migration applied.

The official Stripe documentation describes Dashboard webhook registration and signing secrets, local forwarding, raw-body signature verification, Checkout subscriptions, portal sessions, and test cards: [webhooks](https://docs.stripe.com/webhooks?lang=node), [Checkout subscriptions](https://docs.stripe.com/billing/subscriptions/build-subscriptions?locale=en-GB&ui=embedded-form), [customer portal](https://docs.stripe.com/customer-management), and [test cards](https://docs.stripe.com/testing?testing-method=card-numbers).

## Local webhook testing

Install and authenticate the Stripe CLI separately from the LaunchSite install. Do not store the CLI login secret in Git.

```powershell
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI prints a temporary `whsec_...`; put that value in the local `.env` as `STRIPE_WEBHOOK_SECRET` while the listener is running. Restart the dev server after changing environment variables. Use the Checkout flow with a test card such as `4242 4242 4242 4242`, any future expiry (for example `12/34`), and any valid CVC. The CLI will show webhook deliveries. A test event triggered from the Dashboard may contain fake objects that do not correspond to a real subscription; use an actual test-mode Checkout subscription for end-to-end entitlement verification.

## Manual acceptance checklist

Free user:

1. Sign in as a user with no BillingAccount.
2. Create, edit, generate content for, and preview a project.
3. Click Publish. It must remain unpublished and show “Publishing is available on Starter and Business plans” with a View plans link.

Starter:

1. Open Pricing and choose Starter.
2. Complete Stripe test Checkout.
3. Confirm `checkout.session.completed` and subscription events reach `/api/stripe/webhook`.
4. Refresh Account → Billing. It should show Starter and Active (or the current Stripe status).
5. Publish one project. A second new project must show the published-site limit error.
6. Republish/edit the first project; it must remain allowed.

Business:

1. Repeat with Business.
2. Publish up to three projects, then verify a fourth new publication is blocked.

Billing Portal and cancellation:

1. Open Account → Billing → Manage billing.
2. Verify Stripe Portal opens and returns to `/account/billing`.
3. Schedule cancellation in Stripe. Verify the webhook updates `cancelAtPeriodEnd` and the displayed active-until date.
4. Confirm publishing remains available while the subscription is still active.
5. After Stripe reports `canceled`, verify new paid publishing is blocked while existing public sites remain accessible.

Regression:

1. Open the existing published public slug signed out; it must still render without a Stripe lookup.
2. Confirm `/examples`, Summit Ridge Roofing, and GreenLine Outdoor Services still render.
3. Verify another user cannot publish or manage the first user’s project or billing portal.
4. Verify an admin can still manage official demos, while an admin cannot publish an ordinary user’s private project merely because of the admin role.

## Validation run

The following checks passed:

```powershell
npm.cmd run db:validate
npm.cmd run db:generate
npx.cmd prisma migrate status
npx.cmd prisma migrate deploy
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
node tests/browser-smoke.cjs
```

There are 42 passing automated tests. They cover Free fallback, all paid statuses, Starter/Business limits, atomic concurrent publishing, ownership and demo exceptions, authenticated plan-only Checkout, Customer reuse, interrupted Checkout recovery, duplicate base-subscription prevention, Billing Portal ownership, unknown prices, subscription item mapping, idempotent/current-state webhook synchronization, old-subscription ordering, signature verification, webhook payload limits, billing UI status, and historical public-site preservation. Headless Edge also passed public-site, demo, authentication, pricing, webhook-rejection, and responsive light/dark layout checks.

## Remaining limitations

- Real Stripe Dashboard Price IDs, secret keys, webhook secret, and portal configuration still need to be created and entered by the owner.
- The application does not implement annual billing, coupons, invoices UI, or the recurring Featured Business add-on.
- Business’s initial limit is three published sites, chosen as the practical MVP default; it is centralized in `plans.ts` and can be changed without touching Stripe reconciliation.
- Stripe CLI forwarding and live test-card Checkout require the owner’s Stripe account and were not performed here.
- No deployment was made and no credentials were added to `.env`.
