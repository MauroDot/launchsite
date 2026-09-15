import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteRenderer } from "@/components/site-renderer";
import { getProject } from "@/lib/project-repository";

export const dynamic = "force-dynamic";

export default async function ProjectPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let project: Awaited<ReturnType<typeof getProject>> | undefined;
  try { project = await getProject(id); } catch (error) { if (error instanceof Error && error.message === "NOT_FOUND") notFound(); console.error("Unable to load website preview", { projectId: id, error }); }
  if (project === undefined) return <section className="mx-auto max-w-3xl px-5 py-20 sm:px-8"><h1 className="text-3xl font-semibold">This preview is temporarily unavailable.</h1><p className="mt-4 text-slate-600">We couldn’t retrieve the saved project. Please try again shortly.</p></section>;
  if (!project) notFound();
  return <><div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur sm:px-8"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4"><p className="truncate text-sm font-semibold text-slate-700">Previewing {project.business.businessName}{(project.isDemo || project.isUnassignedSample) && <span className="ml-2 rounded-full bg-lime-100 px-2 py-1 text-xs text-lime-800">{project.isUnassignedSample ? "Unassigned sample" : "Demo site"}</span>}</p><Link className="shrink-0 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800" href={`/dashboard/projects/${project.id}`}>← Return to project</Link></div></div><SiteRenderer project={project} /></>;
}
