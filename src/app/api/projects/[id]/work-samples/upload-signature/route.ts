import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/access";
import { rateLimit, requestKey, tooManyResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const limited = rateLimit(requestKey(request, `upload:${id}`), 10, 60_000);
  if (!limited.ok) return tooManyResponse(limited.retryAfter);
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
  const image = body.mediaType === "IMAGE";
  const allowedFormats = image ? "jpg,png,webp" : "mp4,mov,webm";
  const maxFileSize = image ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
  const signing = `allowed_formats=${allowedFormats}&folder=${folder}&max_file_size=${maxFileSize}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(`${signing}${config.apiSecret}`).digest("hex");
  return NextResponse.json({ cloudName: config.cloudName, apiKey: config.apiKey, timestamp, folder, signature, allowedFormats, maxFileSize, resourceType: image ? "image" : "video" });
}
