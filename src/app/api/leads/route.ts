import { NextResponse } from "next/server";
import { createPublicLead } from "@/lib/leads/service";
import { rateLimit, requestKey, tooManyResponse } from "@/lib/rate-limit";
export async function POST(request: Request) { const limited = rateLimit(requestKey(request, "lead"), 5, 60_000); if (!limited.ok) return tooManyResponse(limited.retryAfter); try { const payload = await request.json(); await createPublicLead(payload, request.headers.get("host")); return NextResponse.json({ ok: true }); } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "This message could not be submitted." }, { status: 400 }); } }
