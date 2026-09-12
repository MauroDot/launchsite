import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperationalError } from "@/lib/operational-logging";
export const runtime = "nodejs";
export async function GET() { const timestamp = new Date().toISOString(); try { await prisma.$queryRaw`SELECT 1`; return NextResponse.json({ status: "ok", app: "LaunchSite", timestamp, checks: { database: "ok" } }, { headers: { "Cache-Control": "no-store" } }); } catch (error) { logOperationalError({ category: "DATABASE", action: "health-check", error }); return NextResponse.json({ status: "degraded", app: "LaunchSite", timestamp, checks: { database: "unavailable" } }, { status: 503, headers: { "Cache-Control": "no-store" } }); } }
