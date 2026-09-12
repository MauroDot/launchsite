import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteRenderer } from "@/components/site-renderer";
import { getPublicProject } from "@/lib/project-repository";
import { publicSiteSeo } from "@/lib/seo";
import { StructuredBusinessData } from "@/components/structured-business-data";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getPublicProject((await params).slug);
  if (!project) return {};
  const seo = publicSiteSeo(project);
  return { title: { absolute: seo.title }, description: seo.description, alternates: { canonical: seo.canonicalUrl }, robots: seo.robots, openGraph: { title: seo.title, description: seo.description, url: seo.canonicalUrl, type: "website", siteName: "LaunchSite", ...(seo.image ? { images: [{ url: seo.image }] } : {}) }, twitter: { card: seo.image ? "summary_large_image" : "summary", title: seo.title, description: seo.description, ...(seo.image ? { images: [seo.image] } : {}) } };
}

export default async function PublicSitePage({ params }: Props) {
  const project = await getPublicProject((await params).slug);
  if (!project) notFound();
  return <main className="public-site"><StructuredBusinessData project={project} /><SiteRenderer project={project} trackAnalytics /></main>;
}
