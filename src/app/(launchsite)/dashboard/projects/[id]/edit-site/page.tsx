import { notFound } from "next/navigation";
import { PublishSiteControls } from "@/components/publish-site-controls";
import { SiteContentEditor } from "@/components/site-content-editor";
import { getProject } from "@/lib/project-repository";

export default async function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const project = await getProject(id); if (!project) notFound(); return <><div className="mx-auto max-w-7xl px-5 pt-8"><PublishSiteControls key={`${project.isPublished}-${project.publicSlug}`} projectId={project.id} businessName={project.business.businessName} isPublished={project.isPublished} publicSlug={project.publicSlug} /></div><SiteContentEditor project={project} /></>;
}
