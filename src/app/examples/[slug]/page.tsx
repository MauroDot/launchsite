import { notFound } from "next/navigation";
import { SiteRenderer } from "@/components/site-renderer";
import { getDemoProject } from "@/lib/project-repository";
export default async function ExamplePage({ params }: { params: Promise<{ slug: string }> }) { const project = await getDemoProject((await params).slug); if (!project) notFound(); return <SiteRenderer project={project} />; }
