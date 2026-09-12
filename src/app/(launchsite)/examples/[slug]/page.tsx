import { notFound, redirect } from "next/navigation";
import { SiteRenderer } from "@/components/site-renderer";
import { getDemoProject, getPublicProject } from "@/lib/project-repository";
export default async function ExamplePage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const project = await getDemoProject(slug); if (project) return <SiteRenderer project={project} />; const publishedProject = await getPublicProject(slug); if (publishedProject?.publicSlug) redirect(`/site/${publishedProject.publicSlug}`); notFound(); }
