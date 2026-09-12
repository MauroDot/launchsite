import Link from "next/link";
import { listAdminProjects } from "@/lib/project-repository";

export const dynamic = "force-dynamic";

export default async function AdminFeaturedBusinessesPage() {
  const projects = await listAdminProjects();
  return <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8"><Link className="text-sm font-semibold text-slate-600" href="/admin">Back to admin</Link><p className="mt-6 eyebrow">Featured Businesses</p><h1 className="mt-4 text-4xl font-semibold">Promoted placements</h1><p className="mt-2 max-w-2xl text-slate-600">Featured businesses are separate from official examples. Select any project to configure its promotional placement.</p><div className="mt-8 grid gap-4 md:grid-cols-2">{projects.map((project) => <article className="rounded-2xl border p-6" key={project.id}><div className="flex flex-wrap gap-2"><h2 className="text-xl font-semibold">{project.businessName}</h2>{project.featuredBusiness?.enabled && <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Enabled</span>}</div><p className="mt-1 text-sm text-slate-600">{project.businessType}</p><Link className="mt-5 inline-block text-sm font-semibold" href={`/dashboard/projects/${project.id}`}>Configure featured business</Link></article>)}</div></section>;
}
