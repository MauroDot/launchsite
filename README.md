# LaunchSite

## Publishing

Publishing uses a LaunchSite-hosted URL at `/site/<public-slug>`. Published sites read their current saved content and theme, so later saved edits become live immediately. Unpublishing removes the public route while retaining the private project. `publicSlug` is separate from the internal project slug so custom domains or LaunchSite subdomains can map to the same site later.

The project and website editor offer **Publish site**, **View live site**, **Save public address**, and **Unpublish**. Save content before publishing: publishing itself does not save unsaved editor fields. The reserved address stays assigned after unpublishing. Changing it retires the old URL without a redirect.

Suggested slugs use the business name, lowercase ASCII letters/numbers and single hyphens, with a 72-character limit. Automatic collisions receive `-2`, `-3`, etc.; simultaneous reservations are resolved by the database unique index with retries. Custom addresses must be 3-72 characters and return an error if already reserved. Short or non-ASCII-only business names default to `website`.

Publishing is authorized server-side for the project owner, plus administrators managing official demos. Being an administrator does not grant publishing access to someone else's private project. Official `/examples` routes use their separate demo rules; unpublishing a demo's customer URL does not remove its example page.

The public route is dynamic and resolves only an exact, published `publicSlug`. `toPublicSite` in `src/lib/public-site.ts` copies only website fields, strips internal identifiers and nested debug keys, and supplies the shared renderer used by private preview. Private service notes are not used as fallback website copy. The `(launchsite)` route group contains application navigation, so public customer pages do not render account/admin controls at all. This route group does not change existing URLs.

Featured Businesses use enabled placements within their optional date window. Published projects can link to their live site. Unpublished placements show only explicitly configured marketing title/description/image and never receive a project link; placements without a marketing title are omitted. Configure an image on the placement rather than relying on private work samples.

The existing migration `20260912120000_public_publishing` adds `isPublished`, `publishedAt`, `lastPublishedAt`, and unique nullable `publicSlug`. `publishedAt` records first publication; `lastPublishedAt` records the latest publish/address operation, not every content save. No snapshot or version history is stored. On deployment, run `npx.cmd prisma migrate deploy` before starting the application; never reset an existing database. Set `NEXT_PUBLIC_APP_URL` in local `.env` and the deployment environment to the application's origin for canonical/Open Graph URLs. No new secrets are required.

See [Task 010 verification and acceptance checks](docs/task-010.md) for coverage and remaining manual checks.

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

`NEXT_PUBLIC_APP_URL` is the public URL of the application. It defaults to `http://localhost:3000` in `.env.example`; set it to the production URL during deployment.

## Authentication

LaunchSite currently uses Google OAuth only. Set `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` in `.env`. A Gmail address is not required: users may sign in with any email address that is associated with a Google Account.

To bootstrap the LaunchSite owner console, add the owner addresses to the server-only `ADMIN_EMAILS` variable. Use a comma-separated list and sign in again with one of those Google accounts:

```env
ADMIN_EMAILS="owner@your-domain.com,second-owner@your-domain.com"
```

Matching accounts are promoted to `ADMIN` server-side. Do not expose this variable to the browser. The `/admin` routes are also checked against the persisted role on every request.
