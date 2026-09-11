import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/access";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireProjectAccess(id);
  } catch {
    // Deliberately indistinguishable from a missing project.
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  const config = { cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, apiKey: process.env.CLOUDINARY_API_KEY, apiSecret: process.env.CLOUDINARY_API_SECRET };
  if (!config.cloudName || !config.apiKey || !config.apiSecret) return NextResponse.json({ error: "Media uploads are not configured." }, { status: 503 });
  const body = await request.json().catch(() => null) as { mediaType?: string } | null;
  if (body?.mediaType !== "IMAGE" && body?.mediaType !== "VIDEO") return NextResponse.json({ error: "Invalid media type." }, { status: 400 });
  const project = await prisma.websiteProject.findUnique({ where: { id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `launchsite/${id}`;
  const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${config.apiSecret}`).digest("hex");
  return NextResponse.json({ cloudName: config.cloudName, apiKey: config.apiKey, timestamp, folder, signature, resourceType: body.mediaType === "VIDEO" ? "video" : "image" });
}
