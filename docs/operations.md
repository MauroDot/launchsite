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
