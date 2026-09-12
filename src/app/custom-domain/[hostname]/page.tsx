import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteRenderer } from "@/components/site-renderer";
import { getPublicProjectByDomain } from "@/lib/project-repository";

export const dynamic = "force-dynamic";

async function domainProject(params: Promise<{ hostname: string }>) {
  const hostname = (await params).hostname.toLowerCase().replace(/\.$/, "");
  return { hostname, project: await getPublicProjectByDomain(hostname) };
}

export async function generateMetadata({ params }: { params: Promise<{ hostname: string }> }): Promise<Metadata> {
  const { hostname, project } = await domainProject(params);
  if (!project) return {};
  const content = project.generatedContent;
  const title = content?.seo.title ?? `${project.business.businessName} | ${project.business.category}`;
  const description = content?.seo.description ?? project.business.description;
  return { title: { absolute: title }, description, alternates: { canonical: `https://${hostname}` }, openGraph: { title, description, url: `https://${hostname}`, type: "website" } };
}

export default async function CustomDomainPage({ params }: { params: Promise<{ hostname: string }> }) {
  const { project } = await domainProject(params);
  if (!project) notFound();
  return <main className="public-site"><SiteRenderer project={project} trackAnalytics /></main>;
}
