import { getAppUrl } from "@/lib/app-url";
import { NextResponse, type NextRequest } from "next/server";
import { isInternalHostname } from "@/lib/domains/routing";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const secure = (response: NextResponse) => { response.headers.set("X-Content-Type-Options", "nosniff"); response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin"); response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()"); response.headers.set("X-Frame-Options", "SAMEORIGIN"); response.headers.set("Content-Security-Policy", "default-src 'self'; img-src 'self' data: blob: https:; connect-src 'self' https://api.cloudinary.com https://api.stripe.com https://accounts.google.com; frame-src 'self' https://js.stripe.com https://accounts.google.com; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; font-src 'self' data:; base-uri 'self'; form-action 'self' https://accounts.google.com https://checkout.stripe.com https://connect.stripe.com " + getAppUrl() + "; frame-ancestors 'self'"); if (pathname.startsWith("/receipts/") || pathname.startsWith("/api/payments/")) { response.headers.set("Referrer-Policy", "no-referrer"); response.headers.set("Cache-Control", "private, no-store"); response.headers.set("X-Robots-Tag", "noindex, nofollow"); } if (process.env.NODE_ENV === "production") response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains"); return response; };
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/") || pathname.startsWith("/custom-domain/") || pathname === "/robots.txt" || pathname === "/sitemap.xml") return secure(NextResponse.next());
  const host = request.headers.get("host")?.split(":", 1)[0]?.toLowerCase().replace(/\.$/, "");
  const canonical = new URL(process.env.NEXT_PUBLIC_APP_URL || "https://launchsite-two.vercel.app").hostname;
  if (!host || isInternalHostname(host, canonical)) return secure(NextResponse.next());
  const rewrite = request.nextUrl.clone();
  rewrite.pathname = `/custom-domain/${host}`;
  return secure(NextResponse.rewrite(rewrite));
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
