# LaunchSite operations guide

This guide covers safe visibility and recovery for the production LaunchSite deployment. PostgreSQL runs on Railway and the Vercel application connects through the configured public `DATABASE_URL`. Migrations are forward-only and deployed with Prisma.

## Monitoring

Use `GET /api/health` for lightweight uptime checks. It verifies only that the app can execute a simple database query; it never calls Stripe, Resend, Cloudinary, OpenAI, or Vercel and never returns configuration values. The admin-only `/admin/system-health` page shows configuration presence and local database status, not proof that third-party services are operational. External uptime or error monitoring may watch `/api/health` and the canonical homepage without adding a vendor SDK.

## Production environment checklist

Confirm these in Vercel Project Settings without placing values in source control:

- `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`
- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- `STRIPE_SECRET_KEY`, `STRIPE_STARTER_PRICE_ID`, `STRIPE_BUSINESS_PRICE_ID`, `STRIPE_FEATURED_BUSINESS_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `LEAD_NOTIFICATION_FROM`
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `OPENAI_API_KEY`
- `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, and `VERCEL_TEAM_ID` when applicable
- `NEXT_PUBLIC_SUPPORT_EMAIL` when support email should be displayed

## Backup checklist

1. Confirm the correct Railway project and PostgreSQL database.
2. Confirm which provider backup and retention options are enabled in the Railway dashboard for the current plan.
3. Before a risky migration, take a provider snapshot or backup when available.
4. Keep migrations forward-only and review SQL before deployment.
5. Never use `prisma migrate reset` in production or casually delete the production database.

Railway backup capabilities and retention vary by plan and must be verified in the Railway dashboard; this repository does not assume a particular backup policy.

## Database recovery

### App deployment failed while the database is healthy

Roll back or promote the last known-good Vercel deployment, then verify `/api/health`. Do not change the database for an app-only rollback unless migration compatibility has been reviewed.

### Migration failed

Run `npx prisma migrate status`, inspect the failed migration and provider logs, and resolve it deliberately. Do not run a reset. Use `npx prisma migrate deploy` only after the migration state and SQL are understood.

### Database unavailable

Check Railway service status, public networking, `DATABASE_URL` presence, and credentials. Do not rotate or remove working values unnecessarily.

### Accidental deletion or corruption

Stop writes if necessary, identify the last known-good provider backup, restore into a safe environment first where possible, validate the application, and only then plan a production cutover. Do not automate destructive restores through the app.

Safe commands:

```powershell
npx.cmd prisma validate
npx.cmd prisma migrate status
npx.cmd prisma migrate deploy
```

Never use in production:

```powershell
prisma migrate reset
prisma db push --force-reset
```

## Service incident runbooks

### Stripe

Check Stripe Dashboard webhook delivery and failed attempts, verify the webhook secret and trusted Price IDs, and replay events when appropriate. The webhook remains billing authority; do not manually fake subscription state in PostgreSQL. For Featured Business, verify the trusted add-on Price ID, subscription item, local entitlement, and selected published project.

### Resend

Verify `RESEND_API_KEY` and `LEAD_NOTIFICATION_FROM`, inspect Resend activity, and confirm recipient selection uses project contact email with owner fallback. Use `scripts/test-lead-email.cjs` and `scripts/show-lead-recipient.cjs` when present. Lead persistence is independent from notification delivery.

### Cloudinary

Verify Cloudinary configuration and the signed upload endpoint, test project ownership/authentication, and check signed file type and size restrictions. Existing stored media URLs remain usable while new uploads are unavailable.

### OpenAI

Verify the API key and quota. Generation failures must not remove or break existing content or published sites. Existing user-facing errors are intentionally safe and do not expose model/provider details.

### Custom domains

Inspect local `Domain` status, Vercel attachment status, and customer DNS. The LaunchSite slug remains the fallback URL. The canonical app origin remains `https://launchsite-two.vercel.app`; do not delete it or remove `*.vercel.app` protections.

## Deployment rollback and escalation

Inspect the latest Vercel deployment and compare it with the last known-good deployment. Roll back or promote the known-good deployment using the Vercel workflow available to the project. Avoid database changes during app-only rollback. Escalate with the deployment ID, timestamp, route, safe error category, and relevant Stripe event ID or project ID; never include secrets, tokens, cookies, raw IPs, or full lead messages.

## Logging and rate limits

Operational logs use categories such as `DATABASE`, `STRIPE`, `RESEND`, `CLOUDINARY`, `OPENAI`, `DOMAIN`, `LEAD`, `ANALYTICS`, and `ADMIN`. They must exclude credentials, tokens, cookies, raw IPs, and full lead bodies. Public lead, analytics, upload, and AI paths have bounded protections documented in the README. The current limiter is in-memory and instance-local on Vercel.

## Merchant payments / Stripe Connect (Task 021)

See [payments.md](payments.md) for schema, currency limits, Stripe Dashboard steps, environment placement, receipts, and the release checklist. Merchant payments and LaunchSite SaaS billing are separate systems. Never repair merchant state by modifying `BillingAccount`, SaaS customers/subscriptions, or Featured Business records.

### Deployment prerequisites

The product owner confirmed that `20260914160000_customer_payments` is already applied. Tasks 021.1–021.3 change no schema and apply no migration. Merchant creation/status and hosted onboarding use Accounts v2 and Account Links v2, inheriting the merchant client's `2026-08-26.dahlia` without preview overrides. Direct-charge payment endpoints remain v1 with the same connected-account ID. Accounts use full Dashboard access and Stripe fee/loss collection; no recipient or customer configuration is added.

Keep `STRIPE_CONNECT_WEBHOOK_SECRET` for the **Connected accounts / Snapshot** payment destination at `/api/stripe/connect/webhook`. Add `STRIPE_CONNECT_ACCOUNTS_WEBHOOK_SECRET` for the **Your account / Thin** Accounts v2 lifecycle destination at `/api/stripe/connect/webhook?events=accounts`. Configure both destinations and their event lists exactly as documented in `payments.md`. Thin notifications are unversioned and verified with the SDK notification parser; readiness is retrieved from current account state with required include fields and the optional signed context. Without a context, retrieval uses the platform key without a context override. Reuse `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, and `LEAD_NOTIFICATION_FROM`. Configure test and production secrets separately. The existing SaaS webhook secret/destination remains unchanged.

PDFKit runs on Node with its package externalized; Next output tracing includes the bundled Noto Sans Latin WOFF file. Smoke-test the deployed PDF endpoint to catch packaging problems. Do not log receipt tokens while doing so.

### Merchant checkout or webhook incident

1. Inspect `/admin/payments` for project status and payment-source counts. Compare the connected merchant in Stripe Dashboard, its capabilities, and destination deliveries. The UI intentionally omits raw account IDs and financial details.
2. Confirm the payment destination uses **Connected accounts / Snapshot** without the query, while Accounts v2 lifecycle uses **Your account / Thin** with `?events=accounts`. Each destination must use its own signing secret and matching live/test mode. A 400 means missing/invalid signature or wrong event format/destination; 413 means oversized payload; 503 means missing configuration; 500 indicates reconciliation needs retry. Legacy `account.updated` is no longer a readiness source.
3. Replay failed deliveries from Stripe after fixing the cause. Receipt/state/event writes are one database transaction. Retries are safe and retrieve current Stripe state, so an older successful-payment event cannot undo an already confirmed refund.
4. For a pending payment, inspect its known session/intent in that connected account. Metadata contains a server-created merchant payment reference. Re-deliver a supported event; do not use a browser success URL, a manual SQL PAID update, or a manual payment record as proof of Stripe settlement.
5. For an account-create attempt older than 23 hours with no local account association, inspect Stripe request logs using the retained `merchant-account-v2:<payment-settings-id>` idempotency key and safe logged request ID. New account payloads contain no project metadata; display name/email alone are not proof of ownership. If a matching account exists, link it through a reviewed, exact-project operational repair and refresh real Stripe status. If no account was created, a reviewed retry may clear the attempt time. The app deliberately does not automatically create another account after idempotency retention may have expired. An earlier request made with different parameters may produce an idempotency conflict after this patch; inspect the original request instead of changing the key or deleting settings to bypass it. Never manually fake eligibility.
6. For a lost checkout response, retry the same browser request/session while within the retention window; the stored pending snapshot and stable Stripe idempotency key prevent duplicates. An old pending record without a session may require inspection of Stripe metadata to reconcile the actual attempt. Do not delete payment history merely to clear an error.

Disable a payment offer or unpublish the project to stop new public checkout. Downgrades also stop new native checkout. Existing payments and refunds continue syncing. Do not disable SaaS billing to resolve a merchant-payment problem.

### Receipts and external payment records

Manual records only assert what the business recorded. No PayPal/Venmo/Cash App/bank API verification or refund processing is implemented. Record external refunds only after the business handles money through the original provider. Stripe refunds are initiated in Stripe and synced via Connect events. Taxes are business-supplied amounts, not tax advice.

Public receipt URLs are bearer credentials. If leaked, the owner can revoke access on the payment detail screen; previous links then stop working. Re-enable to issue a new token. Owner view/PDF continues to work while sharing is off. Do not paste tokens or receipt contents into operational logs/tickets. HTML/PDF responses are private/no-store, noindex, and no-referrer; check these headers if changing middleware, CDN, or routing.

For receipt mail failures, verify Resend and the existing verified `LEAD_NOTIFICATION_FROM`. The recipient is the recorded payer email, not a browser override. Check Resend activity for actual delivery. Retry after the receipt/owner cooldown. The transaction survives email errors. Receipt numbers and business/amount snapshots are preserved; don't recreate a payment to resend mail.

### Rate limits and retention

Merchant limits use `PaymentRateLimit` in PostgreSQL, independent from the older in-memory limiter. Request-address bucket keys are SHA-256 hashes. Database unavailability fails closed for new payment operations. Monitor rate-table size; expired rows are disposable operational counters. A reviewed scheduled cleanup can execute:

```sql
DELETE FROM "PaymentRateLimit" WHERE "resetAt" < CURRENT_TIMESTAMP - INTERVAL '1 day';
```

This cleanup targets only expired rate buckets. Never apply it to `CustomerPayment`, receipt counters, line items, or webhook event ledgers. No cleanup was executed by Task 021. Receipt counters and webhook ledgers must retain their idempotency history.

Admin account deletion stops before changing data when any project has merchant settings/offers/payments. Use a separate reviewed retention/account-closure process; ordinary deletion must not orphan merchant history or cancel anything in Stripe implicitly. Rolling back application code can leave the new additive tables in place. Do not reverse this migration by dropping payment data.

### Validation limits

The automated suite uses mocked Stripe/Resend and a transactional database double for merchant services. Complete the Stripe test-mode and real-PostgreSQL concurrency/retry checklist in `payments.md` before production traffic. The September 14 audit found three high-severity reports in the pre-existing Prisma CLI dependency chain (`deepmerge-ts` through `@prisma/config`); track remediation separately without an unreviewed Prisma major upgrade.
