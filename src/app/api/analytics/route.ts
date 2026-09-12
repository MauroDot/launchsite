import { NextResponse } from "next/server";
import { recordPublicPageView } from "@/lib/analytics/service";
export async function POST(request: Request) { try { await recordPublicPageView(await request.json(), request.headers.get("host")); return NextResponse.json({ ok: true }); } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Analytics event rejected." }, { status: 400 }); } }
