import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/access";
import { rateLimit, requestKey, tooManyResponse } from "@/lib/rate-limit";
import { cloudinarySignedParams, uploadPolicy } from "@/lib/cloudinary-upload";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const limited = rateLimit(requestKey(request, `upload:${id}`), 10, 60_000);
  if (!limited.ok) return tooManyResponse(limited.retryAfter);
  try {
    await requireProjectAccess(id);
  } catch (error) {
    if (!(error instanceof Error && ["NOT_FOUND", "UNAUTHENTICATED"].includes(error.message))) {
      // Never log arbitrary exception messages, request bodies, or credentials.
      console.error("Cloudinary upload authorization failed", { projectId: id, stage: "project-access" });
    }
    // Deliberately indistinguishable from a missing project.
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  const config = { cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, apiKey: process.env.CLOUDINARY_API_KEY, apiSecret: process.env.CLOUDINARY_API_SECRET };
  if (!config.cloudName || !config.apiKey || !config.apiSecret) return NextResponse.json({ error: "Media uploads are not configured." }, { status: 503 });
  const body = await request.json().catch(() => null) as { mediaType?: string } | null;
  if (body?.mediaType !== "IMAGE" && body?.mediaType !== "VIDEO") return NextResponse.json({ error: "Invalid media type." }, { status: 400 });
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `launchsite/${id}`;
  const { allowedFormats, maxFileSize, resourceType } = uploadPolicy(body.mediaType);
  const signedParams = cloudinarySignedParams({ allowedFormats, folder, timestamp });
  const signing = Object.entries(signedParams).map(([key, value]) => `${key}=${value}`).join("&");
  const signature = createHash("sha1").update(`${signing}${config.apiSecret}`).digest("hex");
  console.info("Cloudinary upload parameters signed", { projectId: id, resourceType, signedParams });
  return NextResponse.json({ cloudName: config.cloudName, apiKey: config.apiKey, timestamp, folder, signature, allowedFormats, maxFileSize, resourceType }, { headers: { "Cache-Control": "no-store" } });
}
