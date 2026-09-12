import { NextResponse } from "next/server";
import { recordPublicPageView } from "@/lib/analytics/service";
import { rateLimit, requestKey, tooManyResponse } from "@/lib/rate-limit";
export async function POST(request: Request) { const limited = rateLimit(requestKey(request, "analytics"), 120, 60_000); if (!limited.ok) return tooManyResponse(limited.retryAfter); try { await recordPublicPageView(await request.json(), request.headers.get("host")); return NextResponse.json({ ok: true }); } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error && /Invalid|Published site not found/.test(error.message) ? error.message : "Analytics event rejected." }, { status: 400 }); } }
