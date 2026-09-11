# LaunchSite

LaunchSite is a Next.js application that will help small-business owners turn a description of their business into a professional website.

## Current foundation

This foundation includes a responsive marketing homepage, shared application chrome, and local website-creation wizard. The wizard turns entered business details into a deterministic, responsive website preview. Its typed input and generated content models are intentionally separated from the renderer so a future AI/content service can supply structured content without replacing the website UI.

It uses PostgreSQL with Prisma to persist website projects and services. It intentionally includes no authentication, AI integration, billing, publishing, or external infrastructure.

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

## Environment variables

`DATABASE_URL` is required by Prisma. Set it in your uncommitted `.env` file, for example: `postgresql://USER:PASSWORD@localhost:5432/launchsite?schema=public`.

`NEXT_PUBLIC_APP_URL` is the public URL of the application. It defaults to `http://localhost:3000` in `.env.example`; set it to the production URL during deployment.
