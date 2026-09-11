import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteRenderer } from "@/components/site-renderer";
import { getPublicProject } from "@/lib/project-repository";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getPublicProject((await params).slug);
  if (!project) return {};
  const content = project.generatedContent;
  const title = content?.seo.title ?? `${project.business.businessName} | ${project.business.category}`;
  const description = content?.seo.description ?? project.business.description;
  const path = `/site/${project.publicSlug}`;
  return { title, description, alternates: { canonical: path }, openGraph: { title, description, url: path, type: "website" } };
}

export default async function PublicSitePage({ params }: Props) {
  const project = await getPublicProject((await params).slug);
  if (!project) notFound();
  return <div className="public-site"><SiteRenderer project={project} /></div>;
}
