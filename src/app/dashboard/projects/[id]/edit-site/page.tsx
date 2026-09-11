import { notFound } from "next/navigation";
import { SiteContentEditor } from "@/components/site-content-editor";
import { getProject } from "@/lib/project-repository";

export default async function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const project = await getProject(id); if (!project) notFound(); return <SiteContentEditor project={project} />;
}
