# Task 021 completion report

Implemented locally on September 14, 2026, and updated for **Task 021.1 Accounts v2**. The product owner confirmed that the Task 021 migration has now been applied. Task 021.1 changed no schema, applied no migration, and performed no deployment, commit, or push. Detailed operating instructions and the production checklist are in [payments.md](payments.md) and [operations.md](operations.md).

## Task 021.3 sandbox onboarding correction

The previous create request omitted business name, contact email, and identity country and forced a preview API version. These are confirmed differences from the supplied sandbox guidance. The exact runtime failure is **not confirmed** because the original Stripe error/request ID was not supplied and no remote sandbox account was created during this task. Stripe's current [create reference](https://docs.stripe.com/api/v2/core/accounts/create) uses `2026-08-26.dahlia`; the installed SDK's `cjs/apiVersion.js` agrees. Create-time include and metadata are documented API parameters, so their removal should not be presented as a proven root cause.

The exact create payload is now:

```ts
{
  display_name: project.businessName.trim(),
  contact_email: validBusinessEmail || authenticatedOwnerEmail,
  identity: { country: "us" },
  dashboard: "full",
  defaults: {
    responsibilities: { fees_collector: "stripe", losses_collector: "stripe" },
  },
  configuration: {
    merchant: { capabilities: { card_payments: { requested: true } } },
  },
}
```

Name/email are validated before creation. The fallback email is read from the authenticated owner's database record. Creation omits default currency, metadata, include, legacy type, and customer/recipient configuration. Account create, included-state retrieval, and Account Links v2 inherit the stable client version with no per-request preview override. The link retains merchant-only configuration, currently-due collection, and trusted return/refresh URLs.

The account-attempt timestamp, existing idempotency key, project lock, and stale-attempt refusal remain. Account IDs now commit before retrieval/link creation; both failure paths retain the ID for retry. Readiness is mapped from a separate retrieval with merchant configuration, requirements, and defaults. Previous requests with different parameters may require inspection of Stripe request logs if Stripe returns an idempotency conflict; no key rotation or database reset is attempted.

The existing payment action still passes the caught error and returns a safe generic browser message. Server logging now allowlists error name/type, code, redacted message, and request ID, excluding raw responses, headers, bodies, and stacks.

Changed in 021.3: `src/lib/payments/stripe.ts`, `src/lib/payments/service.ts`, `src/lib/operational-logging.ts`, `tests/customer-payments.test.cjs`, `README.md`, `docs/payments.md`, `docs/operations.md`, and this report. No schema/migration, private environment, SaaS implementation, or SaaS test files changed. No database reset, remote account creation, commit, or push occurred.

Validation: **170 tests passed, 0 failed** (nine new tests), TypeScript and ESLint passed. The tests cover the exact payload, email preference/fallback, retrieval after minimal creation, merchant-only links, concurrent creation, partial-failure reuse, stable SDK request headers, safe diagnostics/browser separation, and existing payments/receipts/SaaS behavior. `npm.cmd run build` encountered a Windows Prisma DLL lock during regeneration; `npx.cmd next build` completed production compilation, type checking, static generation, and route optimization using the existing generated client. Real sandbox onboarding still needs verification through Project → Payments → Connect Stripe.

## Task 021.1 implementation and validation (historical; API version superseded by 021.3)

The installed `stripe@22.6.2` SDK now calls `v2.core.accounts.create` (`POST /v2/core/accounts`), `v2.core.accounts.retrieve` (`GET /v2/core/accounts/{id}`), and `v2.core.accountLinks.create` (`POST /v2/core/account_links`). SDK request options set `Stripe-Version: 2026-08-26.preview` for these calls. No unofficial endpoints, custom HTTP implementation, extra beta headers, or dependency upgrades were introduced. The existing direct-charge payment endpoints use v1 SDK resources with the same v2 connected-account ID and `stripeAccount`; their merchant client is pinned to `2026-08-26.dahlia`. The SaaS client/webhook were not changed.

New accounts receive **merchant only**, `card_payments.requested: true`, full Stripe Dashboard access, and `defaults.responsibilities.fees_collector = stripe` / `losses_collector = stripe`. Merchant payouts are automatically requested by Stripe and read through `configuration.merchant.capabilities.stripe_balance.payouts.status`. There is no recipient/transfer or customer/subscription configuration. The merchant is merchant of record and payment recipient; Stripe collects its processing fees from that merchant and owns the configured connected-account loss collection. LaunchSite takes **zero application fee** and is not configured for connected-account application loss liability.

Hosted onboarding uses `use_case.type = account_onboarding`, `configurations = [merchant]`, currently-due requirement collection, and the existing trusted return/refresh URLs. Existing account IDs are reused. Account retrieval explicitly includes merchant configuration, requirements, and defaults. ACTIVE requires an open account, active card capability, full Dashboard, and Stripe fee/loss configuration. Payout readiness is tracked independently. Closed/unsupported accounts map to DISABLED, restricted/incompatible accounts to RESTRICTED, user-action requirements to ONBOARDING when not payment-ready, and remaining non-active states to PENDING. The retained details-submitted flag means no currently/past-due user action remains in included requirements; it is not a verification claim. Returning from onboarding cannot set ACTIVE.

Accounts v2 lifecycle notifications use **Your account** event-source scope and **Thin** payloads at `/api/stripe/connect/webhook?events=accounts` with `STRIPE_CONNECT_ACCOUNTS_WEBHOOK_SECRET`. The SDK verifies/parses them before the signed account reference is matched to a project. Current account state is fetched with the optional signed context, never from a supplied URL; absent context uses the platform key without a context override. The existing project lock and Connect event ledger provide atomic retry/idempotency behavior. Subscribe to account created/updated/closed, merchant configuration updated/capability-status-updated, requirements updated, and defaults updated. Legacy `account.updated` no longer drives readiness. Checkout/PaymentIntent/refund events use **Connected accounts** scope and **Snapshot** payloads at `/api/stripe/connect/webhook` with `STRIPE_CONNECT_WEBHOOK_SECRET`; `/api/stripe/webhook` and its SaaS secret remain separate.

Validation: **161 tests passed, 0 failed**, including ten added v2 tests and the adapted existing merchant tests. Tests inspect official SDK endpoint/header/JSON behavior using a fake HTTP transport and cover responsibility configuration, payout/card mapping, account reuse, hosted return behavior, signed thin events/context, wrong secrets/destinations, duplicate/out-of-order delivery, and rollback/retry. Existing merchant payments, receipts/manual entries, and SaaS regressions pass. Prisma validation, TypeScript, ESLint, production build, and whitespace checks pass. No live account creation or real Stripe onboarding/payment was performed; configure and test both event destinations in Stripe test mode before rollout.

Changed in **021.1 only**:

```text
.env.example
README.md
docs/operations.md
docs/payments.md
docs/task-021-report.md
src/lib/payments/stripe.ts
src/lib/payments/service.ts
src/lib/payments/webhooks.ts
src/app/api/stripe/connect/webhook/route.ts
tests/customer-payments.test.cjs
```

No schema or migration file changed in 021.1. No legacy Express account creation remains for new merchants. No real connected-account migration/backfill was necessary. Merchant direct charges, zero application fee, separate SaaS billing, existing receipt/manual-payment/rate-limit data, and the absence of raw financial-credential storage are preserved. No destructive database change, migration application, commit, or push occurred in this task. Follow the two-destination Stripe Dashboard instructions and exact event lists in [payments.md](payments.md).

## Current Task 021 feature report

1. **Architecture:** project-scoped external links, Stripe Connect onboarding/direct-charge Checkout, universal payment records, receipts, and safe admin summaries. UI is Project → Payments.
2. **SaaS separation:** merchant Stripe services, database tables, locks, request keys, and event ledger are independent of SaaS subscriptions. Only platform API authentication and read-only entitlement decisions are shared. `BillingAccount` is not reused for merchant funds; existing subscription and Featured Business implementations are preserved.
3. **Files created:** the complete inventory appears below; it includes merchant services, UI/routes, tests, additive SQL, and documentation.
4. **Files modified:** the complete inventory appears below; integration points include project navigation, public rendering, CSP, entitlement flags, PDF packaging, and an admin deletion retention guard.
5. **Schema changes:** seven new models (`ProjectPaymentSettings`, `ExternalPaymentOption`, `PaymentItem`, `CustomerPayment`, `PaymentLineItem`, `ConnectWebhookEvent`, `PaymentRateLimit`), six enums, and project back-relations. New-table checks enforce integer totals, USD, and source integrity. Existing table columns/data are untouched.
6. **Migration:** `prisma/migrations/20260914160000_customer_payments/migration.sql`. Forward-only and additive; applied by the product owner after Task 021. **No new schema change or migration in Task 021.1.**
7. **External links:** owner-authorized create/edit, provider/label/instructions, strict HTTPS URL validation, enabled state and ordering, safe public buttons on both slug/custom-domain sites. Available on all plans.
8. **Connect model:** one connected merchant account per project, status and charge/payout/submission flags, durable account-create attempt timestamp. No financial credentials or identity documents.
9. **Onboarding:** authenticated owner → Accounts v2 merchant creation/reuse → hosted Account Links v2 → trusted return/expired-link route → Accounts v2 status refresh. Accounts have full Stripe Dashboard access and Stripe fee/loss collection. Ambiguous old account creation attempts require support review rather than risking duplicate accounts.
10. **Checkout:** connected-account direct charges, server-resolved project/offer/account/currency, USD fixed/deposit/custom amounts, plan/publication/capability checks, stable retry keys, and a persisted pending snapshot. No application fee. Browser returns never confirm payment.
11. **Webhook:** `/api/stripe/connect/webhook` handles existing payment snapshots; `?events=accounts` handles Accounts v2 thin lifecycle notifications with a distinct signing secret and SDK parser. Both retain context, signature/body bounds, current-state reconciliation, and atomic event/state writes under a project lock. Existing SaaS webhook remains unchanged.
12. **Transactions:** immutable business/line-item/amount snapshots, customer data, source/method/status, processor references, refunded amount, receipt metadata, and bounded project-scoped filters/search. No automatic CRM lead creation/merge.
13. **Manual payments:** owners record received external payments using server-calculated multi-item totals, tax amount, discount, date, reference, and receipt note. Source is always manually recorded, never processor-verified. Partial/full refund or void recording does not call payment provider APIs.
14. **Receipt numbering:** atomic per-project counter with a unique `(projectId, receiptNumber)` constraint; examples `LS-000001`, `LS-000002`. Concurrent and duplicate event tests cover numbering/retry behavior.
15. **PDFs:** on-demand PDFKit in the Node runtime, embedded Noto Sans Latin font, automatic multi-page text, no OS/browser subprocesses, no permanent duplicate PDFs. View/print/PDF available. Build tracing includes the PDF package and font.
16. **Receipt email:** owner-only Resend HTML email containing the secure receipt link, recipient derived from the payment, verified configured sender, shared owner/receipt limits, and provider idempotency. Failures preserve records. No production emails were sent.
17. **Stripe receipts:** Stripe-hosted official receipt URL shown separately when available, alongside the LaunchSite receipt. Raw processor account/intent identifiers stay out of public receipt data.
18. **Refunds:** current Stripe charge refund totals synchronize partial/full refunds; stale success events cannot undo them. Manual records support explicit external refund/void recording only. No native refund controls.
19. **Plans:** external links on Free/Starter/Business; new manual records and native checkout on Starter/Business. Existing receipts/refunds remain manageable after downgrade; webhooks continue reconciling. No prices changed.
20. **Security:** exact ownership checks, Server Actions, checkout Origin validation, trusted canonical/domain logic, strict integer amounts, safe text rendering, limited raw webhook bodies, database-backed rate limits, random 256-bit receipt tokens with revocation, no-store/noindex/no-referrer receipt responses, and safe logs. Admin merchant visibility is aggregate/read-only. Admin deletion stops before changing accounts that have retained merchant settings/offers/payments.
21. **Tests/results:** **161 passed, 0 failed** after Task 021.1 (64 merchant tests, one retention regression, and 96 existing tests). Prisma validation, TypeScript, ESLint, and `git diff --check` pass. Task 021's headless Edge checks covered the unchanged expanded Payments dashboard fixture at 390, 768, and 1440 pixels. Task 021's `npm audit` reported **three high-severity findings in the pre-existing Prisma development-tool chain**, from `deepmerge-ts@7.1.5`; dependencies were not changed in Task 021.1.
22. **Production build:** successful on installed Next.js 16.3.4. All merchant routes compiled. PDFKit and the Latin WOFF font are present in the PDF route's output trace. This verifies packaging, not a deployed live PDF request.
23. **Stripe Dashboard setup:** enable Accounts v2/Connect, Stripe-owned pricing, and full Stripe Dashboard access. Configure **Connected accounts / Snapshot** payments at `/api/stripe/connect/webhook` and **Your account / Thin** Accounts v2 lifecycle events at `/api/stripe/connect/webhook?events=accounts`. Follow the exact event lists in [payments.md](payments.md). Leave SaaS products/prices/webhooks intact.
24. **Vercel environment:** retain `STRIPE_CONNECT_WEBHOOK_SECRET` and add `STRIPE_CONNECT_ACCOUNTS_WEBHOOK_SECRET` for thin events; reuse existing `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, and `LEAD_NOTIFICATION_FROM`. Put local secrets in the root private environment file and production secrets in Vercel Project Settings → Environment Variables. `.env.example` documents the secrets; private environment files were not edited.
25. **Manual production checklist:** confirm the previously applied Task 021 schema; verify real PostgreSQL concurrency/retries; test Accounts v2 states, both destinations, hosted onboarding/expired links, native checkout/decline/cancel/delayed success/refunds on both site host types, plan/owner isolation, manual methods, deployed PDF/email, and revocation. The complete ordered checklist is in [payments.md](payments.md).
26. **Limitations/TODOs:** real service integration testing awaits migration/configuration; tests use Stripe/Resend mocks and a transactional database double. PDF font coverage is Latin/Western European; broader scripts need additional embedded fonts. Receipt logo is deferred. No platform fees, non-USD currency, automatic email, tax calculation, automated external verification/refunds, general Stripe-account import, dispute/accounting integration, CRM linking, or payment analytics events. Three audit reports in `deepmerge-ts` → `@prisma/config` → `prisma` remain; remediation should be a separately reviewed dependency change, not a forced Prisma major upgrade.

## Explicit preservation and security confirmations

- No destructive reset, DROP, TRUNCATE, or existing-table recreation occurred. Task 021.1 applied no migration; the product owner separately applied the additive Task 021 migration. Existing users, projects, subscription state, and other data were not modified by implementation or tests.
- LaunchSite SaaS Stripe billing remains separate and preserved; there is no second use of `BillingAccount` for merchant funds.
- Featured Business, domains, leads/CRM, analytics, SEO, and onboarding remain preserved; the full existing regression suite passed.
- The integration introduces no raw card data, bank credentials, KYC-document, or Connect OAuth-token storage. Stripe hosts payment collection and onboarding.
- Manually recorded external payments are explicitly **not** represented as independently verified.
- Connect processing is idempotent through project serialization, unique constraints, stable processor identifiers, and transactional event/receipt writes. Its real PostgreSQL/Stripe deployment verification remains on the release checklist.
- Public receipt access uses unguessable cryptographically random tokens and supports revocation. Public receipt DTOs exclude internal IDs and unrelated records.
- No secrets or payer payloads were logged by the merchant implementation; no secrets were committed. No commit or push was made, and private environment files were untouched.

## New files

```text
docs/payments.md
docs/task-021-report.md
prisma/migrations/20260914160000_customer_payments/migration.sql
src/app/(launchsite)/admin/payments/page.tsx
src/app/(launchsite)/dashboard/projects/[id]/payments/page.tsx
src/app/(launchsite)/dashboard/projects/[id]/payments/error.tsx
src/app/(launchsite)/dashboard/projects/[id]/payments/connect/page.tsx
src/app/(launchsite)/dashboard/projects/[id]/payments/[paymentId]/page.tsx
src/app/actions/payments.ts
src/app/api/payments/checkout/route.ts
src/app/api/payments/owner-receipt/[id]/pdf/route.ts
src/app/api/payments/receipts/[token]/pdf/route.ts
src/app/api/stripe/connect/webhook/route.ts
src/app/payment/[outcome]/page.tsx
src/app/receipts/[token]/page.tsx
src/components/payment-form.tsx
src/components/print-receipt.tsx
src/components/public-payments.tsx
src/components/receipt-view.tsx
src/lib/payments/core.ts
src/lib/payments/pdf.ts
src/lib/payments/queries.ts
src/lib/payments/receipts.ts
src/lib/payments/service.ts
src/lib/payments/stripe.ts
src/lib/payments/validation.ts
src/lib/payments/webhooks.ts
tests/customer-payments.test.cjs
```

## Modified files

```text
.env.example
.gitignore
README.md
docs/operations.md
middleware.ts
next.config.ts
package.json
package-lock.json
prisma/schema.prisma
src/app/(launchsite)/admin/page.tsx
src/app/(launchsite)/dashboard/projects/[id]/page.tsx
src/app/custom-domain/[hostname]/page.tsx
src/app/site/[slug]/page.tsx
src/lib/admin-user-management.ts
src/lib/billing/policy.ts
tests/admin-users.test.cjs
```
