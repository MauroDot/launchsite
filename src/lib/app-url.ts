import "server-only";

const CANONICAL_PRODUCTION_APP_URL = "https://launchsite-two.vercel.app";

// Shared with metadata and billing. Never build payment redirects from request
// headers or Vercel deployment aliases. A production deployment must always
// return to the canonical OAuth/Stripe origin, even if a deployment-specific
// VERCEL_URL is present or NEXT_PUBLIC_APP_URL was omitted by mistake.
export function getAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const value = configured || (process.env.NODE_ENV === "production" ? CANONICAL_PRODUCTION_APP_URL : "http://localhost:3000");
  const url = new URL(value);
  const isOriginPath = /^\/*$/.test(url.pathname);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || !isOriginPath || url.search || url.hash) throw new Error("Invalid application origin configuration");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Application origin must use HTTPS");
  return url.origin;
}

/** Configure Auth.js to use the same stable origin as Stripe return URLs. */
export function configureAuthUrl() {
  const appUrl = getAppUrl();
  if (process.env.NODE_ENV === "production" || !process.env.AUTH_URL) {
    process.env.AUTH_URL = appUrl;
  }
  return appUrl;
}
