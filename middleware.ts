import { NextResponse, type NextRequest } from "next/server";
import { isInternalHostname } from "@/lib/domains/routing";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/") || pathname.startsWith("/custom-domain/") || pathname === "/robots.txt" || pathname === "/sitemap.xml") return NextResponse.next();
  const host = request.headers.get("host")?.split(":", 1)[0]?.toLowerCase().replace(/\.$/, "");
  const canonical = new URL(process.env.NEXT_PUBLIC_APP_URL || "https://launchsite-two.vercel.app").hostname;
  if (!host || isInternalHostname(host, canonical)) return NextResponse.next();
  const rewrite = request.nextUrl.clone();
  rewrite.pathname = `/custom-domain/${host}`;
  return NextResponse.rewrite(rewrite);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
