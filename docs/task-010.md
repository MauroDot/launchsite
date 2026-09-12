# Task 010: public publishing

## Implementation

| Area | Result |
| --- | --- |
| Schema/migration | Reused the existing `20260912120000_public_publishing` forward migration: `isPublished` defaults false; `publishedAt`, `lastPublishedAt`, and unique `publicSlug` are nullable. Prisma reports all 10 migrations applied. No reset, new redundant migration, or customer data mutation was needed. |
| Public route | `/site/[slug]` dynamically loads only exact valid slugs with `isPublished = true`. Unknown, malformed, missing, and unpublished addresses return 404. Production errors show a generic retry screen. |
| Slugs | Business-name suggestions normalize to lowercase ASCII/hyphens, at most 72 characters. Automatic collisions receive numeric suffixes; unique-index races retry. Explicit custom slugs require 3-72 characters and return a clear reservation error. Unpublish reserves the slug; changing it does not redirect the former URL. |
| Publishing UX | Controls appear on both project details and the website editor. Publish shares saved data; later saves go live immediately. Unsaved edits remain local. Published controls offer View live site, Save public address, and Unpublish. |
| Authorization | Every publishing mutation invokes server-side ownership checks. Admin exceptions apply only to official demos. Demo-setting changes also require project access, preventing an unrelated admin from converting a customer's private project into a public demo. |
| Public boundary | `toPublicSite` explicitly copies website content and nested JSON fields. It excludes project/user IDs, private notes, admin metadata, generation/debug fields, and Cloudinary management metadata. Media/testimonial React keys are synthetic. Contact email comes from the business profile, never the user's account. |
| Rendering | Public sites, previews, editor previews, and demos share `SiteRenderer`. Classic, Conversion, Showcase, theme controls, gallery images/videos, testimonials, contact links, and section ordering remain supported. Long text wraps and auto-contrast labels use their section background. Dark buttons receive an outline when their fill blends into the page. |
| Navigation | The `(launchsite)` route group owns application chrome. Public customer sites never render the account header/footer, including in the HTML/React response. Existing application URLs are unchanged. |
| Admin | Project cards show publication status, reserved/public slug, and first publication date. Customer publishing access is not broadened. |
| Demos | `/examples` and existing named demo routes keep their separate `isDemo` checks. Unpublishing a demo's `/site/` URL does not remove its `/examples/` page. |
| Featured Businesses | Query requires enabled placement, optional date window, and project relationship. No demo requirement. Only published projects receive `/site/` links. Private placements use explicit promotional metadata; those lacking a marketing title are omitted. |
| SEO | Factual or saved generated title/description, Open Graph fields, and canonical URL. Customer titles omit the LaunchSite title suffix. `NEXT_PUBLIC_APP_URL` supplies the origin through root metadata. |

## Verification

Run from the project directory:

```powershell
npm.cmd run db:validate
npm.cmd run db:generate
npx.cmd prisma migrate status
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

All were run successfully during implementation. Prisma initially hit a Windows DLL lock; only identified LaunchSite dev processes were stopped, and generation then succeeded. The database was not reset or pushed.

The 20 automated tests include real repository/action/authorization code with in-memory persistence and authentication doubles. They cover owner publish/unpublish/rename, other-user and unrelated-admin rejection, signed-out rejection, official demo management, automatic and concurrent slug collisions, malformed URLs, generic database errors, saved-versus-unsaved content, reserved slugs, public DTO filtering, Featured Business data/link filtering, cache invalidation, and renderer output for all three layouts and both light/dark themes. They do not write production data.

For the browser smoke test, start the production server after building:

```powershell
npm.cmd run start
```

In another terminal, using Node 22+ and an installed Microsoft Edge:

```powershell
node tests/browser-smoke.cjs
```

Optional environment overrides are `SMOKE_APP_URL`, `SMOKE_PUBLIC_SLUG`, and `EDGE_PATH`. The default smoke fixture references the current Red River public slug and the two named demo slugs; update those route fixtures if the database's example addresses change. Screenshots are written to a unique directory under Windows Temp.

Headless Edge checks passed against the local production build:

- Existing Red River site loaded signed out at 390, 768, and 1440 pixels, with no horizontal overflow, usable factual contact links, SEO metadata, and no application/account links or private fields in its response.
- Missing, unknown, malformed, and private-project addresses returned 404.
- `/examples`, Summit Ridge Roofing, and GreenLine Outdoor Services loaded successfully.
- Signed-out `/admin` returned the existing 404 response; `/dashboard` redirected to sign-in.
- Synthetic long business names, descriptions, galleries, videos, and testimonials rendered in all three layouts at all three widths with Minimal Neutral and Premium Dark themes (18 combinations), without page overflow or clipped text/media. No customer projects were changed to generate these fixtures.

## Remaining acceptance checks and limits

The existing Red River site was already published. Its public rendering was verified, but the Google-authenticated owner editor flow was not exercised in a real user session. The publish/save/rename/unpublish/republish cycle is covered by automated repository/action tests with test doubles, rather than committed changes to that customer's project.

To finish account-level acceptance, sign in as the normal project owner, open its editor, save a small edit, publish if needed, and open the live link in a signed-out browser. Confirm saved changes appear, unsaved changes do not, then unpublish and confirm a fresh request returns 404. Verify the private preview and project remain available, and republish if the site should remain live. Use a second normal account to verify project access is denied and an admin account to inspect status/date fields and demo controls.

There is no snapshot/version history, custom-domain automation, or Stripe integration. Slug availability is checked on save, rather than continuously while typing. Unpublishing prevents subsequent requests from loading the site; it cannot erase a copy already loaded or saved by a visitor. Optional browser checks target Chromium/Edge; Safari and Firefox were not exercised.

## Deployment

Apply checked-in migrations with `npx.cmd prisma migrate deploy` before deploying the application. Set `NEXT_PUBLIC_APP_URL` to the deployed application's origin, alongside existing database/auth/media environment variables. No new credentials are needed. The checked database already has the publishing migration applied. This task did not deploy the application.
