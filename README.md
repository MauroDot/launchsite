# LaunchSite

LaunchSite is a Next.js application that will help small-business owners turn a description of their business into a professional website.

## Current foundation

This foundation includes a responsive marketing homepage, shared application chrome, and local website-creation wizard. The wizard turns entered business details into a deterministic, responsive website preview. Its typed input and generated content models are intentionally separated from the renderer so a future AI/content service can supply structured content without replacing the website UI.

It intentionally includes no database, authentication, AI integration, billing, publishing, or external infrastructure.

## Local setup

1. Install Node.js 20.9 or newer.
2. In this project directory, install dependencies:

   ```powershell
   npm.cmd install
   ```

3. Copy the example environment file and set values as needed:

   ```powershell
   Copy-Item .env.example .env.local
   ```

4. Start the development server:

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

## Environment variables

`NEXT_PUBLIC_APP_URL` is the public URL of the application. It defaults to `http://localhost:3000` in `.env.example`; set it to the production URL during deployment.
