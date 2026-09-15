# Task 021: customer payments and universal receipts

## Architecture and billing separation

Merchant payments belong to a **project**. LaunchSite subscriptions belong to a **user**. They have separate records, Stripe service modules, webhook endpoints, event ledgers, and database lock namespaces. `BillingAccount`, SaaS customer/subscription/price IDs, Featured Business state, subscription checkout, and subscription webhook processing are not reused for merchant funds. The only shared Stripe configuration is the platform's server-only `STRIPE_SECRET_KEY`. Merchant entitlements read the existing subscription policy; they do not write subscription state.

The implementation follows [Stripe direct charges](https://docs.stripe.com/connect/direct-charges?platform=web&ui=stripe-hosted): a Checkout Session is created with the connected account in the SDK's `stripeAccount` request option. Its payment and balance belong to that merchant. No transfer redistribution, destination charge, subscription customer reuse, or application fee is implemented. A future application fee belongs in this merchant Checkout layer after a separate product decision.

Task 021.1 replaces the initial, undeployed Accounts v1 implementation with **Accounts v2**. New accounts use `stripe.v2.core.accounts.create`, hosted onboarding uses `stripe.v2.core.accountLinks.create`, and status refresh uses `stripe.v2.core.accounts.retrieve`. The installed `stripe@22.6.2` SDK supports these endpoints directly; no raw HTTP fallback or SDK upgrade is required. Task 021.3 removes the per-request preview overrides: all merchant requests inherit the client's `2026-08-26.dahlia`, matching the installed SDK default and [current account API reference](https://docs.stripe.com/api/v2/core/accounts/create). The separate SaaS billing client is unchanged.

Creation also sends `display_name` from the project business name, `contact_email` from its valid business email (otherwise the authenticated owner's stored email), and `identity: { country: "us" }`. A missing valid email produces a safe validation message before Stripe creation. The minimal create payload omits metadata, include, default currency, legacy account type, and customer/recipient configurations. After committing the returned account ID, retrieval requests `configuration.merchant`, `requirements`, and `defaults` before readiness mapping. Stripe's API supports create-time include and metadata; omitting them follows the supplied sandbox guidance and is not proof they caused the earlier failure.

Creation sends `dashboard: "full"`, `configuration.merchant.capabilities.card_payments.requested: true`, and `defaults.responsibilities: { fees_collector: "stripe", losses_collector: "stripe" }`. Stripe collects processing fees directly from the merchant and handles connected-account loss collection; LaunchSite is not configured as the connected account's loss-liable application. The merchant remains responsible for its transactions and balances under its Stripe agreement. This does not change responsibilities for LaunchSite's own platform balance. See [Stripe responsibility fields](https://docs.stripe.com/connect/accounts-v2/connected-account-configuration).

The merchant configuration automatically requests `stripe_balance.payouts`; there is no separate payouts-request parameter to invent and no recipient/transfer configuration is needed. See [merchant payout capabilities](https://docs.stripe.com/connect/integrate-billing-connect). No `customer` configuration is added: existing LaunchSite subscriptions remain on their existing SaaS customers and BillingAccount records. No connected accounts existed at the time of this change, so no account migration/backfill or duplicate account ID fields were required.

## Project Payments screen

Open a project and choose **Payments** (`/dashboard/projects/[id]/payments`). Five areas provide:

1. **External payment links:** PayPal, Venmo, Cash App, bank-hosted payment links, and Other. Owners can create/edit labels, HTTPS URLs, instructions, visibility, and order. Ten links per project. Free, Starter, and Business can configure these links; publication still follows the existing publishing entitlement.
2. **Stripe setup:** connect/continue setup, return status refresh, retry expired links, and refresh status on demand. Only actual project owners may manage merchant settings, including for administrators. Accounts v2 hosted onboarding collects financial/identity information on Stripe, never in LaunchSite. The UI shows readiness, restrictions, and payout availability without raw account IDs.
3. **Payment offers:** up to 30 fixed-price, deposit, or custom-amount offers. Native checkout requires Starter/Business, a published project, an enabled offer, and active Stripe charge capability. Custom limits are configurable on each offer: minimum at least $0.50, maximum at most $10,000. USD is enforced server-side and by database constraints. Fixed prices ignore browser-supplied amounts, accounts, currencies, and price IDs.
4. **Manual payment entry:** multiple line items, customer details, received date, tax amount, discount, method, external reference, and a note printed on the receipt. Integer quantities and exact decimal-to-cent conversion produce totals server-side. New records require Starter/Business. Manual source is always `MANUAL_EXTERNAL`; `STRIPE` is not a manual payment method.
5. **Transactions and receipts:** this project's records, bounded 25-row pages, customer/email/receipt/reference search, method/status/date filters, and receipt details. Date filters use record creation dates in UTC. The selected project supplies the project filter. Summary counts include settled and subsequently refunded payments; recorded revenue subtracts refunds and excludes voids. It is not audited accounting.

Downgrades hide native offers and prevent new merchant checkout/manual entries. Existing records, receipt access, emailing, access revocation, and corrections/refund recording remain available. Webhooks continue reconciling existing payments regardless of plan or publication state. Payments neither create nor merge CRM leads, and do not change analytics or SEO.

## Additive schema and migration

Migration: `prisma/migrations/20260914160000_customer_payments/migration.sql`.

New models:

| Model | Purpose |
| --- | --- |
| `ProjectPaymentSettings` | One merchant account per project, capability flags, durable account-create attempt time, atomic receipt counter |
| `ExternalPaymentOption` | Provider type, display text, secure link, visibility, ordering |
| `PaymentItem` | Controlled offer data and custom-amount limits |
| `CustomerPayment` | Customer/business snapshot, integer totals, method/source/status, refund totals, processor references, receipt/access metadata, idempotent request key |
| `PaymentLineItem` | Ordered receipt items with server-calculated totals |
| `ConnectWebhookEvent` | Separate Connect event ID/account ledger |
| `PaymentRateLimit` | Shared fixed-window rate limits across Vercel instances |

Six new enums represent account status, external providers, offer type, payment method, source, and status. `WebsiteProject` receives Prisma back-relations only; its existing columns are not changed. The migration creates new tables/enums/indexes and adds constraints to new tables only. CHECK constraints enforce USD, amount arithmetic, and manual-versus-Stripe source separation. No DROP, TRUNCATE, data reset, existing-table recreation, or BillingAccount changes.

**The product owner confirmed the Task 021 migration has already been applied. Task 021.1 makes no schema changes and runs no migrations.** For a fresh environment that has not received Task 021, use the normal reviewed migration deployment process:

```powershell
Set-Location C:\Users\tmaur\LaunchSite
npx.cmd prisma migrate deploy
```

This deploy command applies all outstanding migrations, so inspect migration status first. Never use `migrate reset`. Merchant payment/settings/offer relations prevent project deletion from silently removing financial history. Admin user deletion gives an explicit retention/support error before changing user, project, or subscription records. External links alone do not block deletion.

## Stripe Dashboard and environment setup

1. Use the same Stripe platform as the existing SaaS integration, with matching test/live mode. Enable Accounts v2/Connect, complete the platform profile, and configure hosted onboarding branding and supported countries. Select the SaaS/Stripe-owned pricing model with full Stripe Dashboard access. The application requests merchant card payments; payouts follow the merchant configuration automatically. Verify Accounts v2 access in the Stripe sandbox/test environment. Do not recreate SaaS products, customers, prices, or subscription webhooks.
2. Configure a **payment snapshot destination** at `https://YOUR-CANONICAL-APP/api/stripe/connect/webhook`. Choose **Connected accounts** as the event source, **Snapshot** payloads, and API version `2026-08-26.dahlia`. Subscribe to `account.application.deauthorized`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `refund.created`, `refund.updated`, and `refund.failed`. Its signing secret stays in `STRIPE_CONNECT_WEBHOOK_SECRET`. Do not use legacy `account.updated` for readiness.
3. Add an **Accounts v2 lifecycle destination** at `https://YOUR-CANONICAL-APP/api/stripe/connect/webhook?events=accounts`. In Workbench/Webhooks → Add destination, select **Your account** as the event source, then advanced options → **Thin** payloads. This scope delivers lifecycle events for the platform's connected merchant Account objects. Subscribe to `v2.core.account.created`, `v2.core.account.updated`, `v2.core.account.closed`, `v2.core.account[configuration.merchant].updated`, `v2.core.account[configuration.merchant].capability_status_updated`, `v2.core.account[requirements].updated`, and `v2.core.account[defaults].updated`. Thin notification envelopes are unversioned; the subsequent account retrieval uses the stable merchant client version. See [Stripe's event format documentation](https://docs.stripe.com/event-destinations).
4. Put the **thin destination's own** signing secret in `STRIPE_CONNECT_ACCOUNTS_WEBHOOK_SECRET`. The query parameter selects a distinct verifier; the two Connect secrets cannot be interchanged. The existing `/api/stripe/webhook` continues to use `STRIPE_WEBHOOK_SECRET` and handles only LaunchSite SaaS billing. These are three separate destinations and secrets in total.
5. In local development put server secrets in the repository-root `.env`, or in `.env.local` according to the existing setup. On Vercel set them under Project Settings → Environment Variables for the appropriate deployment environment. Redeploy after environment changes. Private environment files were not edited by this task.

| Variable | Required use |
| --- | --- |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Connected-account **payment snapshot** signing secret; separate from SaaS secret |
| `STRIPE_CONNECT_ACCOUNTS_WEBHOOK_SECRET` | **New in 021.1:** Accounts v2 **thin lifecycle** signing secret |
| `STRIPE_SECRET_KEY` | Existing server-only platform key, reused for Connect authentication |
| `NEXT_PUBLIC_APP_URL` | Existing trusted canonical LaunchSite origin used for onboarding/checkout return URLs and receipt links |
| `RESEND_API_KEY` | Existing server-only Resend key, required to email receipts |
| `LEAD_NOTIFICATION_FROM` | Existing verified sender reused for receipt mail; do not use a customer-supplied sender |

No Connect publishable key, OAuth token, separate Stripe customer, additional price IDs, or platform-fee variable is required. For local connected-account webhook forwarding:

```powershell
stripe listen --forward-connect-to http://localhost:3000/api/stripe/connect/webhook
```

For Accounts v2 thin forwarding, run a separate listener (and use its separate signing secret):

```powershell
stripe listen --thin-events "v2.core.account.created,v2.core.account.updated,v2.core.account.closed,v2.core.account[configuration.merchant].updated,v2.core.account[configuration.merchant].capability_status_updated,v2.core.account[requirements].updated,v2.core.account[defaults].updated" --forward-thin-to "http://localhost:3000/api/stripe/connect/webhook?events=accounts"
```

Complete a test merchant's onboarding in the Payments screen, then refresh status. Return from onboarding never implies successful verification. Account Links use `use_case.type: "account_onboarding"`, `configurations: ["merchant"]`, `collection_options.fields: "currently_due"`, and the existing trusted return/refresh URLs. See [hosted onboarding](https://docs.stripe.com/connect/saas/tasks/onboard).

## Accounts v2 readiness mapping

Every account read explicitly includes `configuration.merchant`, `requirements`, and `defaults`; omitted include-dependent fields must not be mistaken for readiness. Identity documents or detailed financial information are not fetched or persisted. The existing local fields are reused:

| Local field/status | Accounts v2 meaning |
| --- | --- |
| `stripeChargesEnabled` / `ACTIVE` | Not closed, merchant card capability exactly `active`, full Dashboard access and Stripe fee/loss collection confirmed |
| `stripePayoutsEnabled` | Same account/responsibility checks plus merchant `stripe_balance.payouts.status` exactly `active`; shown independently from card readiness |
| `stripeDetailsSubmitted` | Merchant requirements were included and no currently/past-due requirement awaits action from the user; this is an approximation of completed information entry, **not** KYC verification or the removed v1 flag |
| `DISABLED` | Closed account or unsupported card capability |
| `RESTRICTED` | Restricted card capability or incompatible/missing responsibility configuration on a merchant account |
| `ONBOARDING` | Non-ready account with currently/past-due user action, or missing merchant configuration |
| `PENDING` | Remaining non-active states, including Stripe verification, determining status, or missing capability data |

An active card capability can coexist with future/current information requests or unavailable payouts. Payout and requirement flags remain separate. Unknown capability states never grant charge access. A late return or account event cannot override actual readiness.

## Checkout, webhooks, and retries

Public payment buttons appear on published slug and custom-domain sites. They POST to the canonical LaunchSite checkout endpoint. The server verifies the Origin against the configured app origin or the project's active custom domain, resolves the published project and its enabled offer, reads current Stripe eligibility, and creates a direct-charge Session. Return URLs stay on the trusted LaunchSite origin; the return page resolves a link back to the project's active custom domain or slug. An arbitrary Host header cannot select a checkout return destination. CSP permits only the canonical app and required Stripe hosted form destinations.

The browser returns to `/payment/success` or `/payment/cancel`. These pages do **not** mark a payment paid or expose payer data. The business provides its receipt once webhook confirmation arrives. Checkout, PaymentIntent, charge, and refund APIs still use their supported **v1 payment endpoints with the v2 account ID in `stripeAccount`**. This is documented [Accounts v1/v2 interoperability](https://docs.stripe.com/connect/accounts-v2), not legacy account creation. No destination-charge or application-fee change was made.

Connect verifies the raw-body signature with a 1 MB streaming limit. Payment snapshots use the existing SDK verifier; Accounts v2 thin notifications use `parseEventNotification` with their own secret. Thin events resolve the signed `related_object.id` against the stored project account, ignore unmapped accounts, and retrieve that account's current included state. The signed notification's optional `context` is forwarded as SDK `stripeContext`; when absent, retrieval uses the platform key without a context override. The thin handler does not require `event.account`, so it supports **Your account** delivery. Supplied resource URLs are never fetched. A project lock and the existing Connect event ledger make lifecycle writes atomic/idempotent. Notification order or a claimed closed event never replaces authoritative account retrieval.

A project-scoped PostgreSQL advisory lock serializes account refreshes, checkout, reconciliation, and receipt issuance across instances. Payment events retrieve current Stripe state with the connected account context; delayed events cannot revert a refund to paid. Payment metadata must identify an existing server-created payment snapshot in that project/account. Amount, USD currency, session/intent associations, received amount, and paid charge are checked before settlement is recorded. Other connected-account activity is ignored; this is not a general Stripe-account import.

Payment state, receipt counter increment, receipt issuance, and the processed event marker commit together. A failed transaction rolls back the event marker so Stripe retry can finish. Unique session/intent/charge identifiers, project request keys, and `(projectId, receiptNumber)` prevent duplicate records. No webhook sends receipt emails.

Checkout first commits a pending snapshot before calling Stripe. A retry reuses the same payment ID/Stripe idempotency key and, if available, its existing open session. Account creation also commits an attempt record before its remote call and uses a stable project-settings idempotency key. The returned account ID is committed before included-state retrieval or Account Link creation, so a failure in either later step preserves the account for retry. Ambiguous attempts older than 23 hours fail closed to avoid creating duplicates after Stripe's idempotency retention window. New browser checkout attempts use new keys; a genuinely new customer attempt may create a separate pending payment.

## Receipts and refunds

Every settled payment can have a LaunchSite receipt, regardless of payment method. Business contact information and item totals are snapshotted so later project edits do not rewrite history. Project-local numbers are `LS-000001`, `LS-000002`, etc. They are incremented atomically inside the same transaction as issuance; numbering never uses row count.

Receipt view/print routes use escaped React text. PDFKit generates PDFs on demand in the Node runtime, with a bundled redistributable Noto Sans Latin font. There are no browser subprocesses, arbitrary HTML execution, external logo fetches, or stored duplicate PDFs. Receipts support multi-page line items, customer/contact details, date, subtotal/tax/discount/total, method, status, references, refunds, notes, and generated date. The optional logo is deferred. PDF font coverage currently supports Latin/Western European text; wider scripts need additional embedded fonts (HTML/browser printing retains browser font coverage).

Customers can use a 256-bit cryptographically random bearer token to access exactly one receipt and its PDF. Internal database IDs, owner IDs, Stripe account/intent IDs, private CRM information, and token fields are excluded from the public receipt DTO. Public receipt pages/PDFs are no-store, noindex, and no-referrer. Owners can revoke the link, disabling previously emailed URLs; re-enabling generates a fresh token. Authenticated owner view/PDF still work when sharing is revoked.

Stripe's official `https://pay.stripe.com/...` receipt link is shown separately when the paid charge supplies one. Stripe remains the processor; the LaunchSite receipt supplies consistent business records. Manual receipts explicitly say the business recorded the payment and LaunchSite did not independently verify it.

Receipt email is an owner-authenticated action. It sends an escaped HTML message with a secure receipt link using Resend, the persisted customer email, and the configured sender. Browser-supplied recipients or senders are not accepted. Sharing must be enabled. Rate limits apply per owner and receipt, and Resend gets an idempotency key. Email delivery errors never remove the transaction or receipt. Acceptance by Resend does not guarantee inbox delivery; inspect Resend activity for failures.

Stripe refunds initiated in Stripe sync from current charge state, including partial refunds. No refund API controls are exposed. Owners may record a partial/full refund or void for a manual record only; this records an external action and does not move money. Partial refund amounts are cumulative, cannot decrease, and are validated against the original total. Full refunds and voids are final in this MVP. Receipts remain visible with their updated status.

Tax is an optional amount supplied by the business, not a legal tax calculation. No Stripe Tax, accounting integration, banking service, audited revenue claim, or external provider verification is implemented.

## Security and operations

- Owner operations use authenticated Server Actions and recheck exact project ownership. Administrative merchant views are read-only aggregates at `/admin/payments`; no financial credentials or eligibility overrides are exposed.
- Payment URLs must be public HTTPS, without embedded credentials. React safely renders text; provider URLs are never fetched by the server. External buttons use `noopener noreferrer`.
- Shared PostgreSQL limits protect account links/status refresh, checkout by address/project, configuration, manual entry, PDFs, and email. Address keys are hashed before storage. Expired limit rows can be periodically purged; see the operations runbook.
- No card/PAN/CVV, bank/routing credentials, identity documents, or Connect OAuth-token fields exist. Free-text instructions/notes must not contain sensitive financial credentials.
- Merchant action errors include an allowlist of error name/type, code, redacted message, and Stripe request ID for server diagnostics. Raw SDK responses, request bodies, headers, stacks, and credentials are excluded. Browser responses remain generic for unexpected errors.
- Task 021.1 changed no database data or schema and applied no migrations. No connected-account backfill was needed. No production payment/account/email action, commit, push, or deployment was performed.

## Validation and release checklist

Automated tests cover owner checks, URL rejection/public visibility, account reuse/status, fixed/custom amounts, merchant/currency injection, publication/offer/plan restrictions, signed and duplicate webhooks, rollback/retry, asynchronous failure/success, refund ordering, manual totals/source, receipt numbering/token isolation/revocation/PDF/rendering, email authorization/failure, query scoping, rate limits, admin deletion retention, and additive migration inspection. Existing SaaS billing, Featured Business, domain, lead/CRM, analytics, SEO, hardening, and health tests remain in the full suite.

The merchant service tests use mock Stripe/Resend and an in-memory transactional database double. They do not prove deployed PostgreSQL lock behavior or a real Stripe payout. Responsive layout was checked in headless Edge with mocked dashboard data and expanded forms at 390, 768, and 1440 pixels. Live authenticated browser/Stripe workflows require the migration and configured services and remain release checks.

Before production use:

1. Confirm the environment has the already-applied Task 021 migration. Task 021.1 needs no new migration. For fresh environments only, use the normal reviewed migration process. Verify existing user, project, BillingAccount, domain, CRM, and analytics records remain.
2. Configure the separate Connect destination/secrets. Confirm old SaaS billing and Featured Business webhook deliveries still succeed.
3. Test an owner and a second user: only the owner can change links/offers, onboard, record payments, view private receipts, email, or record refunds. Confirm Free gating and retained receipt access after downgrade.
4. Test Accounts v2 incomplete, pending, active, restricted, closed, and payout-unavailable states. Refresh an expired hosted onboarding link and verify that return alone does not grant readiness. Check both Connect destinations and lifecycle event retries.
5. Pay a test fixed offer, deposit, and custom amount from both slug and active custom-domain sites. Confirm the charge appears on the connected account, with no LaunchSite application fee and no SaaS customer reuse.
6. Exercise cancellation, decline, delayed payment, duplicate and out-of-order webhook delivery, and partial/full refund. Confirm a single receipt per settled payment, including concurrent delivery against PostgreSQL.
7. Record each supported manual method; verify multi-item arithmetic, date, tax, discount, source disclosure, print, PDF, and recipient. Check actual customer-language PDF rendering.
8. Email a receipt in test mode, inspect Resend delivery, revoke its link, verify old links return 404, then regenerate access. Verify PDF downloads after Vercel packaging and private/no-referrer headers.
9. Verify payment tables on mobile and keyboard navigation, all hidden/disabled states, and API error messages. Check external links with the configured provider.
10. Review open dependency audit findings before release: three high-severity reports currently arise from pre-existing `deepmerge-ts@7.1.5` through `@prisma/config` and the Prisma development CLI. PDF dependencies introduced no audit findings. A Prisma/deepmerge upgrade is separate work; do not force a major upgrade as part of deployment.

Known deferred scope: platform transaction fees, non-USD currency, arbitrary merchant transaction import, automated refunds, tax computation, disputes/accounting, receipt logo and wider-script PDF fonts, payment-to-CRM linking, payment analytics events, and automatic receipt emailing. No payment event analytics were added to the existing analytics system.
