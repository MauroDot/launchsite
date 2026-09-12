import "server-only";
import { getAppUrl } from "@/lib/app-url";
import type { PublicSite } from "@/lib/public-site";

function safeImage(value: string | null | undefined) { try { const url = new URL(value || ""); return ["http:", "https:"].includes(url.protocol) ? url.toString() : null; } catch { return null; } }
export function publicSiteSeo(project: PublicSite, fallbackSlug = project.publicSlug ?? "") {
  const title = project.seoTitle?.trim() || project.generatedContent?.seo.title?.trim() || project.business.businessName;
  const description = project.seoDescription?.trim() || project.generatedContent?.seo.description?.trim() || project.business.description || `Learn more about ${project.business.businessName}.`;
  const origin = project.customDomain ? `https://${project.customDomain}` : getAppUrl();
  const canonicalUrl = `${origin}${project.customDomain ? "" : `/site/${fallbackSlug}`}`;
  const image = safeImage(project.socialImageUrl) || safeImage(project.workSamples.find((sample) => sample.mediaType === "IMAGE")?.mediaUrl);
  return { title, description, canonicalUrl, image, robots: project.allowIndexing ? "index, follow" : "noindex, nofollow" };
}

export function structuredBusinessData(project: PublicSite, canonicalUrl: string, image: string | null) {
  const data: Record<string, unknown> = { "@context": "https://schema.org", "@type": project.business.category || project.business.serviceArea ? "LocalBusiness" : "Organization", name: project.business.businessName, url: canonicalUrl, description: project.business.description };
  if (image) data.image = image;
  if (project.business.phone) data.telephone = project.business.phone;
  if (project.business.email) data.email = project.business.email;
  if (project.business.serviceArea) data.areaServed = project.business.serviceArea;
  return data;
}
