import "server-only";

// Shared with metadata and billing. Never build payment redirects from request headers.
export function getAppUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim() || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid application origin configuration");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Application origin must use HTTPS");
  return url.origin;
}
