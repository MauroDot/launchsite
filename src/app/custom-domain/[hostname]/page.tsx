import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteRenderer } from "@/components/site-renderer";
import { getPublicProjectByDomain } from "@/lib/project-repository";
import { publicSiteSeo } from "@/lib/seo";
import { StructuredBusinessData } from "@/components/structured-business-data";
import { PublicPayments } from "@/components/public-payments";

export const dynamic = "force-dynamic";

async function domainProject(params: Promise<{ hostname: string }>) {
  const hostname = (await params).hostname.toLowerCase().replace(/\.$/, "");
  return { hostname, project: await getPublicProjectByDomain(hostname) };
}

export async function generateMetadata({ params }: { params: Promise<{ hostname: string }> }): Promise<Metadata> {
  const { project } = await domainProject(params);
  if (!project) return {};
  const seo = publicSiteSeo(project);
  return { title: { absolute: seo.title }, description: seo.description, alternates: { canonical: seo.canonicalUrl }, robots: seo.robots, openGraph: { title: seo.title, description: seo.description, url: seo.canonicalUrl, type: "website", siteName: "LaunchSite", ...(seo.image ? { images: [{ url: seo.image }] } : {}) }, twitter: { card: seo.image ? "summary_large_image" : "summary", title: seo.title, description: seo.description, ...(seo.image ? { images: [seo.image] } : {}) } };
}

export default async function CustomDomainPage({ params }: { params: Promise<{ hostname: string }> }) {
  const { project } = await domainProject(params);
  if (!project) notFound();
  return <main className="public-site"><StructuredBusinessData project={project} /><SiteRenderer project={project} trackAnalytics /><PublicPayments slug={project.publicSlug} /></main>;
}
