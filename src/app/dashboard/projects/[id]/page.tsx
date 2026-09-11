import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateWizard } from "@/components/create-wizard";
import { getProject } from "@/lib/project-repository";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let project: Awaited<ReturnType<typeof getProject>> | undefined;
  try {
    project = await getProject(id);
  } catch (error) {
    console.error("Unable to load website project", error);
  }
  if (project === undefined) return <section className="mx-auto max-w-3xl px-5 py-20 sm:px-8"><h1 className="text-3xl font-semibold">This project is temporarily unavailable.</h1><p className="mt-4 text-slate-600">We couldn’t retrieve its saved details. Check the database connection and try again.</p></section>;
  if (!project) notFound();
  return <><div className="mx-auto max-w-6xl px-5 pt-8 sm:px-8"><Link className="text-sm font-semibold text-slate-600" href="/dashboard">← All projects</Link><h1 className="mt-5 text-3xl font-semibold">{project.business.businessName}</h1></div><CreateWizard initialProject={project} /></>;
}
