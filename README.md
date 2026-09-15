# LaunchSite

### Legacy admin sample previews (Task 021.6)

Admins can open and preview unassigned legacy projects even when `isDemo` is false. These views label them **Unassigned sample**. This read permission does not assign an owner or grant publishing, payment, domain, or general editing permissions. An admin can explicitly mark the project as a demo using its existing Demo settings; the usual admin demo editing rules then apply.

Public visibility remains explicit: `/examples` and `/examples/[slug]` require `isDemo: true`, independently of publication; `/site/[slug]` requires `isPublished: true`; custom domains also require an active domain. Previewing does not change any of these flags. Missing payment settings, domain, Featured Business metadata, generated content, or legacy theme fields do not require new database records to render.

Read-only diagnosis on September 15, 2026 found Wonder Greens, ClearPath Exterior Cleaning, and Order & Ease Home Organizing had `userId: null` and `isDemo: false`. `requireProjectAccess` rejected that combination with `Error: NOT_FOUND`, which the project page incorrectly presented as a database outage. Project and preview pages now return a 404 for that expected access denial and retain server-side exception logging plus safe fallback UI for operational failures. Summit Ridge Roofing and GreenLine Outdoor Services already had `isDemo: true`; their reported failure was not reproducible in this checkout. All five saved samples rendered successfully after the change using an existing admin identity, and Hearth & Harvest rendered with its owner identity, with authentication simulated for the server-render check. A deployed browser session was not verified.

No sample data, owners, environment files, or schema were changed. No migration is required. Regression coverage is in `tests/legacy-sample-preview.test.cjs`; run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` (use `npm.cmd` on Windows if PowerShell blocks `npm.ps1`). Deploy the application change normally and verify the five previews from Admin → Manage sites. Summit Ridge and GreenLine are already eligible for Examples; the other three require explicit demo opt-in before they appear publicly there.

## Publishing

Publishing uses a LaunchSite-hosted URL at `/site/<public-slug>`. Published sites read their current saved content and theme, so later saved edits become live immediately. Unpublishing removes the public route while retaining the private project. `publicSlug` is separate from the internal project slug so custom domains or LaunchSite subdomains can map to the same site later.

## Billing

Task 011 adds Free, Starter ($19/month), and Business ($39/month) plans through Stripe Checkout and webhook-synchronized local billing records. Free users can build, edit, generate content, and preview; paid plans enable new publishing. Starter allows one published site and Business allows three. Existing published sites remain public after billing changes. Configure the four server-only Stripe variables in `.env` using [the Task 011 setup guide](docs/task-011.md); do not put real values in source control. Local webhook testing uses `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

The project and website editor offer **Publish site**, **View live site**, **Save public address**, and **Unpublish**. Save content before publishing: publishing itself does not save unsaved editor fields. The reserved address stays assigned after unpublishing. Changing it retires the old URL without a redirect.

Suggested slugs use the business name, lowercase ASCII letters/numbers and single hyphens, with a 72-character limit. Automatic collisions receive `-2`, `-3`, etc.; simultaneous reservations are resolved by the database unique index with retries. Custom addresses must be 3-72 characters and return an error if already reserved. Short or non-ASCII-only business names default to `website`.

Publishing is authorized server-side for the project owner, plus administrators managing official demos. Being an administrator does not grant publishing access to someone else's private project. Official `/examples` routes use their separate demo rules; unpublishing a demo's customer URL does not remove its example page.

The public route is dynamic and resolves only an exact, published `publicSlug`. `toPublicSite` in `src/lib/public-site.ts` copies only website fields, strips internal identifiers and nested debug keys, and supplies the shared renderer used by private preview. Private service notes are not used as fallback website copy. The `(launchsite)` route group contains application navigation, so public customer pages do not render account/admin controls at all. This route group does not change existing URLs.

Featured Businesses use enabled placements within their optional date window. Published projects can link to their live site. Unpublished placements show only explicitly configured marketing title/description/image and never receive a project link; placements without a marketing title are omitted. Configure an image on the placement rather than relying on private work samples.

Featured Business is a paid recurring add-on on an existing Starter or Business Stripe subscription. Configure `STRIPE_FEATURED_BUSINESS_PRICE_ID` with the recurring monthly Stripe Price ID. The add-on is added as a subscription item, never a second subscription. Customers select one of their own published sites from Account → Billing; cancellation is scheduled for the current period end when no other Stripe schedule is pending. Public placement requires synchronized local add-on entitlement and a currently published selected project, so public rendering never queries Stripe.

The existing migrations `20260912120000_public_publishing` and `20260912190000_project_seo` add publishing and per-project SEO fields. `publishedAt` records first publication; `lastPublishedAt` records the latest publish/address operation, not every content save. No snapshot or version history is stored. On deployment, run `npx.cmd prisma migrate deploy` before starting the application; never reset an existing database. Set `NEXT_PUBLIC_APP_URL` in local `.env` and the deployment environment to the application's origin for canonical/Open Graph URLs. No new secrets are required.

See [Task 010 verification and acceptance checks](docs/task-010.md) for coverage and remaining manual checks.

## Search and social sharing

Each project can define an SEO title, description, Cloudinary social preview image, and indexing preference from its project settings. The image editor uses the existing signed Cloudinary upload flow, supports preview/replace/remove, and recommends 1200 × 630 JPG, PNG, or WebP images up to 10 MB. Empty fields use generated site SEO when available, then the business name and description. Without a dedicated image, metadata falls back to the first image work sample. Published pages emit canonical metadata, Open Graph and Twitter cards, and escaped Schema.org business JSON-LD. An active custom domain is canonical for its custom-domain page; a LaunchSite slug is canonical at `/site/<public-slug>` when no active custom domain exists. Projects with indexing disabled emit `noindex, nofollow`. `NEXT_PUBLIC_APP_URL` remains the sole canonical application origin for metadata and sitemap URLs.

LaunchSite is a Next.js application that will help small-business owners turn a description of their business into a professional website.

## Current foundation

This foundation includes a responsive marketing homepage, shared application chrome, and local website-creation wizard. The wizard turns entered business details into a deterministic, responsive website preview. Its typed input and generated content models are intentionally separated from the renderer so a future AI/content service can supply structured content without replacing the website UI.

It uses PostgreSQL with Prisma to persist factual business profiles, structured services, separately generated website content, and Auth.js authentication records. Public publishing is implemented; billing is not included.

Work samples and testimonials are stored as URL-and-text metadata. Signed uploads send images and videos directly to Cloudinary; PostgreSQL stores their metadata, not media binaries.

## Local setup

1. Install Node.js 20.9 or newer.
2. In this project directory, install dependencies:

   ```powershell
   npm.cmd install
   ```

3. Create a PostgreSQL database named `launchsite`, then copy the example environment file and set its connection string:

   ```powershell
   if (-not (Test-Path .env)) { Copy-Item .env.example .env }
   ```

4. Install dependencies and generate the Prisma client, then apply the checked-in forward migrations:

   ```powershell
   npm.cmd install
   npm.cmd run db:generate
   npx.cmd prisma migrate deploy
   ```

5. Start the development server:

   ```powershell
   npm.cmd run dev
   ```

6. Open `http://localhost:3000`.

## Verification commands

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

## Database commands

```powershell
npm.cmd run db:generate
npm.cmd run db:validate
npx.cmd prisma migrate status
npx.cmd prisma migrate deploy
```

When updating an existing Task 004 database to the richer business profile, run:

```powershell
npm.cmd run db:migrate
```

## Environment variables

`DATABASE_URL` is required by Prisma. Set it in your uncommitted `.env` file, for example: `postgresql://USER:PASSWORD@localhost:5432/launchsite?schema=public`.

`OPENAI_API_KEY` is required only to generate AI website content. Create an API key in the OpenAI platform and place it in your uncommitted `.env` file. It is accessed only in server-side code and must never be prefixed with `NEXT_PUBLIC_`.

## Cloudinary media uploads

Work samples support existing media URLs and signed direct uploads to Cloudinary. Create a Cloudinary product environment, then set these in your local `.env` and in Vercel Project Settings → Environment Variables:

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
```

Only the cloud name and API key are returned to the browser for a signed upload. `CLOUDINARY_API_SECRET` is used only by the server signature route and must never use a `NEXT_PUBLIC_` prefix.

`NEXT_PUBLIC_APP_URL` is the canonical public URL of the application. For production it must be `https://launchsite-two.vercel.app`; Stripe Checkout and Billing Portal return URLs never fall back to a preview or branch `VERCEL_URL`. Local development defaults to `http://localhost:3000`.

Business-plan custom domains use the server-only Vercel project-domain API. Set `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, and (for a team project) `VERCEL_TEAM_ID` in Vercel and local server environments. The API token is never sent to the browser. Apply the custom-domain migration with `npx prisma migrate deploy` before enabling the feature.

## Authentication

LaunchSite currently uses Google OAuth only. Set `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` in `.env`. A Gmail address is not required: users may sign in with any email address that is associated with a Google Account.

To bootstrap the LaunchSite owner console, add the owner addresses to the server-only `ADMIN_EMAILS` variable. Use a comma-separated list and sign in again with one of those Google accounts:

```env
ADMIN_EMAILS="owner@your-domain.com,second-owner@your-domain.com"
```

Matching accounts are promoted to `ADMIN` server-side. Do not expose this variable to the browser. The `/admin` routes are also checked against the persisted role on every request.
## Lead capture

Published sites include an accessible contact form on both LaunchSite URLs and active custom domains. Submissions are stored as leads before optional email notification, so a Resend outage does not lose a customer message. Configure `RESEND_API_KEY` and `LEAD_NOTIFICATION_FROM` to enable notifications; the customer lead inbox is available at `/dashboard/leads`.

The lead inbox is a lightweight CRM: owners can move leads through New, Contacted, Qualified, Won, and Lost; set or clear follow-up dates; search and filter by project, status, follow-up state, and date range; sort by newest, oldest, or follow-up date; and export an ownership-scoped CSV. Internal notes are separate private records and are never rendered publicly or included in notifications. CSV cells are quoted and formula-like values are prefixed to prevent spreadsheet formula injection. Lists use 25-lead pagination. Existing lead persistence, Resend notifications, and `LEAD_SUBMITTED` analytics events remain unchanged.

## Onboarding and commercial readiness

New accounts with no real projects see a concise first-site empty state with links to create a site, view examples, and review pricing. Demo projects are excluded from this state. Project details include a dynamic nine-item readiness checklist covering business facts, description, contact details, imagery, SEO, preview, contact form availability, and publication. Custom domains, phone numbers, and dedicated social images are recommendations and never hard publish gates.

Public draft pages are available at `/terms`, `/privacy`, and `/support`. These documents describe current LaunchSite behavior and are product drafts; attorney review is recommended before commercial launch. Set `NEXT_PUBLIC_SUPPORT_EMAIL` to show a support contact; when absent, the support page provides general guidance without a broken address.

## Production hardening

Public lead submissions are limited to five requests per minute per request address, analytics ingestion to 120 per minute, and upload-signature requests to ten per minute per project/address. These limits use a bounded in-memory store, so each serverless instance has its own bucket and a durable shared limiter may be added later if abuse volume requires it. Lead validation keeps the honeypot, field limits, ownership/project resolution, and notification failure isolation.

Analytics accepts only published projects and safe path/referrer/visitor-key values; query strings and raw IP addresses are not stored. Cloudinary signatures are authenticated and project scoped, with signed image/video format and file-size limits. AI generation remains owner-authorized and is limited to five generations per hour per user with bounded project input. Security headers include content-type sniffing protection, strict referrer and permissions policies, same-origin framing protection, production HSTS, and an incremental CSP compatible with Next.js, Google auth, Stripe, and Cloudinary.

The application and API error paths return safe user-facing messages without stack traces or secrets. Structured failure logs include only operational identifiers and error types; credentials, tokens, cookies, raw IPs, and full lead messages are excluded. The September 14, 2026 dependency audit reports three high-severity findings in the existing Prisma development-tool chain (`deepmerge-ts` / `@prisma/config` / `prisma`); see the payment release checklist for details.

See [docs/operations.md](docs/operations.md) for health monitoring, environment checks, backup guidance, recovery runbooks, rollback guidance, and service incident handling.

## First-party analytics

Published slug and active custom-domain pages send a small fire-and-forget page-view event after load. Analytics uses a random anonymous first-party browser ID in local storage scoped to each published project; it does not store IP addresses, use third-party cookies, or build cross-site profiles. Referrers are reduced to a safe hostname and broad source category. Visitor counts are approximate, and analytics failures never block page rendering. Customer analytics is available at `/dashboard/analytics`, with seven-day and 30-day views, visitors, leads, conversion rate, daily trends, source summaries, and slug-versus-custom-domain traffic.

## Customer payments and receipts (Task 021)

### One-project sandbox Connect recovery (Task 021.4)

Run from the repository root, replacing `EXACT_PROJECT_ID` with the full ID from `/dashboard/projects/<id>/payments`:

```powershell
node scripts/reset-project-connect.cjs EXACT_PROJECT_ID
node scripts/reset-project-connect.cjs EXACT_PROJECT_ID --confirm
```

The first command is read-only. Review its project ID, business name, current Connect state, and exact proposed reset before running the second command. Missing projects/settings and unknown flags fail. Only an exact `WebsiteProject.id` lookup is used; names and slugs are not resolved.

The CLI uses `DATABASE_URL` from the shell or root environment files, loaded through Next's production-mode environment loader (`.env.production.local`, `.env.local`, `.env.production`, `.env`, in that priority after existing shell variables). Keep the intended Railway URL in your uncommitted root `.env.local` or `.env`; the script never prints credentials or edits environment files. No Stripe key is needed. Dependencies and the generated Prisma client must already be installed (`npm install`).

Confirmed execution updates just the existing project's `ProjectPaymentSettings` row:

| Field | Result |
| --- | --- |
| `stripeConnectAccountId` | `null` |
| `stripeConnectStatus` | `NOT_CONNECTED` |
| `stripeChargesEnabled` | `false` |
| `stripePayoutsEnabled` | `false` |
| `stripeDetailsSubmitted` | `false` |
| `accountAttemptAt` | `null` |

There are no additional Connect lifecycle fields to clear. Clearing `accountAttemptAt` allows the next onboarding attempt through the old-attempt guard. The settings ID, receipt sequence, and timestamps are preserved (the update explicitly retains `updatedAt` to prevent Prisma's automatic timestamp change). All other rows/data remain untouched. The script uses the application's project payment lock and rejects an update if the reviewed settings changed before the write. It prints the resulting state only after the transaction commits. No schema changes, migrations, Stripe calls, account creation, or row deletion occur.

Run this one-off recovery while this project's onboarding, status refresh, and sandbox webhook processing are idle; it does not cancel already-running requests. This is specifically for the confirmed sandbox-to-live transition, not a general same-mode account replacement tool: onboarding retains its existing settings-ID-based idempotency key. After reset, open the deployed project's Payments page, verify **Not connected**, and use **Connect Stripe** with the deployment's live configuration. Verify onboarding, status refresh, and checkout afterward; the CLI itself cannot validate live Stripe behavior.

### Payment architecture

Project → **Payments** supports external payment links on all plans, plus Stripe Connect card checkout and manually recorded payments on Starter/Business. Payments are USD-only, with integer-cent arithmetic and a $10,000 per-payment limit. Receipts provide owner/customer views, print, PDF download, optional Resend email, and revocable random-token sharing. Manual receipts clearly disclose that the business supplied the payment information; LaunchSite does not independently verify PayPal, Venmo, bank, cash, check, or other external payments.

Merchant accounts/payments use separate project-scoped tables, Stripe services, and `/api/stripe/connect/webhook`. Existing `BillingAccount` subscriptions and `/api/stripe/webhook` are preserved. Checkout uses connected-account direct charges without a LaunchSite transaction fee. No card data, bank credentials, or identity documents are collected by this integration.

The product owner confirmed that `20260914160000_customer_payments` has been applied. Tasks 021.1–021.3 require no schema changes or additional migrations. New merchant accounts use **Accounts v2**, merchant card capabilities, full Stripe Dashboard access, and Stripe-owned fee/loss collection. Task 021.3 adds business name/contact email/US identity to the minimal create payload and uses the SDK's stable `2026-08-26.dahlia` client version without preview overrides. Account IDs are committed before retrieval and onboarding-link creation so retries reuse them. Direct-charge Checkout still uses the connected account as merchant and takes no application fee. Hosted onboarding uses Account Links v2.

Keep `STRIPE_CONNECT_WEBHOOK_SECRET` for the **Connected accounts / Snapshot** payment destination at `/api/stripe/connect/webhook`, and add `STRIPE_CONNECT_ACCOUNTS_WEBHOOK_SECRET` for the **Your account / Thin** Accounts v2 lifecycle destination at `/api/stripe/connect/webhook?events=accounts`. Put these in the root local environment file and matching Vercel environment; add server-only `STRIPE_CONNECT_SECRET_KEY` from the verified LaunchSite Connect platform account to Vercel **Production** and redeploy. Keep `STRIPE_SECRET_KEY` unchanged for SaaS subscriptions and Featured Business billing. Locally, set the dedicated Connect key in the root `.env.local` or `.env`. Continue using the existing canonical app URL, Resend key, and verified sender. Private `.env` files were not edited. See the payment setup guide for the exact event subscriptions and API versions.

See [merchant payment architecture, setup, tests, limitations, and release checklist](docs/payments.md), [Task 021 implementation report](docs/task-021-report.md), and [operational recovery](docs/operations.md). Merchant-specific rate limits are shared in PostgreSQL. Existing general-purpose rate limits remain instance-local. Admins have read-only merchant summaries and cannot delete accounts with retained merchant configuration/records through the ordinary user-deletion flow.
