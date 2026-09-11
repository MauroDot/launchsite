# LaunchSite

LaunchSite is a Next.js application that will help small-business owners turn a description of their business into a professional website.

## Current foundation

This foundation includes a responsive marketing homepage, shared application chrome, and local website-creation wizard. The wizard turns entered business details into a deterministic, responsive website preview. Its typed input and generated content models are intentionally separated from the renderer so a future AI/content service can supply structured content without replacing the website UI.

It uses PostgreSQL with Prisma to persist factual business profiles, structured services, and separately generated website content. It intentionally includes no authentication, billing, publishing, or external infrastructure.

Work samples and testimonials are stored as URL-and-text metadata only. LaunchSite does not store media binaries in PostgreSQL; direct file uploads are a future milestone.

## Local setup

1. Install Node.js 20.9 or newer.
2. In this project directory, install dependencies:

   ```powershell
   npm.cmd install
   ```

3. Create a PostgreSQL database named `launchsite`, then copy the example environment file and set its connection string:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Install dependencies and generate the Prisma client, then create the database schema:

   ```powershell
   npm.cmd install
   npm.cmd run db:generate
   npm.cmd run db:migrate -- --name init
   ```

5. Start the development server:

   ```powershell
   npm.cmd run dev
   ```

5. Open `http://localhost:3000`.

## Verification commands

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

## Database commands

```powershell
npm.cmd run db:generate
npm.cmd run db:validate
npm.cmd run db:migrate -- --name init
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
