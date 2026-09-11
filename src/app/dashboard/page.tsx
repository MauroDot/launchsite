import Link from "next/link";
import { listProjects } from "@/lib/project-repository";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let projects = null;
  try {
    projects = await listProjects();
  } catch (error) {
    console.error("Unable to load dashboard projects", error);
  }
  if (!projects) return <section className="mx-auto max-w-3xl px-5 py-20 sm:px-8"><h1 className="text-3xl font-semibold">Your dashboard is temporarily unavailable.</h1><p className="mt-4 leading-7 text-slate-600">We couldn’t reach the project database. Check your database connection and try again.</p></section>;
  return <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8"><div className="flex items-end justify-between"><div><p className="eyebrow">Workspace</p><h1 className="mt-4 text-4xl font-semibold">Your websites</h1></div><Link className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white" href="/create">Create a website</Link></div>{projects.length === 0 ? <p className="mt-10 text-slate-600">No saved projects yet.</p> : <div className="mt-10 grid gap-4 md:grid-cols-2">{projects.map((project) => <article className="rounded-2xl border border-slate-200 p-6" key={project.id}><Link className="block" href={`/dashboard/projects/${project.id}`}><h2 className="text-xl font-semibold">{project.business.businessName}</h2><p className="mt-1 text-sm text-slate-600">{project.business.category}</p><p className="mt-7 text-sm">{project.visualStyle} · {project.status.toLowerCase()} · Updated {project.updatedAt.toLocaleDateString()}</p></Link><div className="mt-5 flex gap-4"><Link className="text-sm font-semibold text-slate-700 hover:text-slate-950" href={`/dashboard/projects/${project.id}`}>Open project</Link><Link className="text-sm font-semibold text-slate-700 hover:text-slate-950" href={`/dashboard/projects/${project.id}/preview`}>Preview</Link></div></article>)}</div>}</section>;
}
