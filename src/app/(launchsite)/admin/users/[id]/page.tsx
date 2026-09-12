import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUserProjects } from "@/lib/project-repository";

export default async function AdminUserProjectsPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await getAdminUserProjects((await params).id);
  if (!data) notFound();
  return <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8"><Link className="text-sm font-semibold text-slate-600" href="/admin/users">Back to users</Link><p className="mt-6 eyebrow">User projects</p><h1 className="mt-4 text-3xl font-semibold">{data.user.name ?? data.user.email ?? "User"}</h1><p className="mt-2 text-slate-600">{data.user.email}</p><div className="mt-8 grid gap-4 md:grid-cols-2">{data.projects.map((project) => <article className="rounded-2xl border p-6" key={project.id}><h2 className="font-semibold">{project.businessName}</h2><p className="mt-1 text-sm text-slate-600">{project.businessType}</p><p className="mt-4 text-sm text-slate-500">Updated {project.updatedAt.toLocaleDateString()}</p></article>)}</div>{data.projects.length === 0 && <p className="mt-8 text-slate-600">This user does not own any projects.</p>}</section>;
}
