import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getAppUrl();
  const projects = await prisma.websiteProject.findMany({
    where: { isPublished: true, allowIndexing: true, publicSlug: { not: null } },
    select: { publicSlug: true, updatedAt: true, domain: { select: { status: true } } },
  });
  return [{ url: origin, lastModified: new Date() }, ...projects.flatMap((project) => project.publicSlug && project.domain?.status !== "ACTIVE" ? [{ url: `${origin}/site/${project.publicSlug}`, lastModified: project.updatedAt }] : [])];
}
