import type { PersistedWebsiteProject } from "./website-types";
export type ReadinessItem = { key: string; label: string; complete: boolean; href?: string };
export function getProjectReadiness(project: PersistedWebsiteProject): ReadinessItem[] {
  const business = project.business;
  const meaningful = (value: string | undefined | null, length = 1) => Boolean(value?.trim() && value.trim().length >= length);
  const image = project.workSamples.some((sample) => sample.mediaType === "IMAGE" && meaningful(sample.mediaUrl));
  const seo = meaningful(project.seoTitle) || meaningful(project.seoDescription) || meaningful(project.generatedContent?.seo?.title) || meaningful(project.generatedContent?.seo?.description) || meaningful(business.businessName);
  return [
    { key: "business", label: "Business information", complete: meaningful(business.businessName) && meaningful(business.category), href: "#business-editor" },
    { key: "description", label: "Business description", complete: meaningful(business.description, 20), href: "#business-editor" },
    { key: "email", label: "Contact email", complete: /^\S+@\S+\.\S+$/.test(business.email), href: "#business-editor" },
    { key: "phone", label: "Phone number", complete: meaningful(business.phone), href: "#business-editor" },
    { key: "images", label: "At least one image", complete: image, href: "#business-editor" },
    { key: "seo", label: "SEO settings", complete: seo, href: "#seo-settings" },
    { key: "contact", label: "Contact form", complete: true },
    { key: "preview", label: "Site preview reviewed", complete: Boolean(project.generatedContent), href: `/dashboard/projects/${project.id}/preview` },
    { key: "published", label: "Site published", complete: project.isPublished, href: "#publish-controls" },
  ];
}
