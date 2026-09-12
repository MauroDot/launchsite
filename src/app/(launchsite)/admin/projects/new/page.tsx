import Link from "next/link";
import { CreateWizard } from "@/components/create-wizard";

export default async function AdminCreateProjectPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  if (!type) return <section className="mx-auto max-w-3xl px-5 py-16"><Link className="text-sm font-semibold text-slate-600" href="/admin/projects">Back to projects</Link><p className="mt-6 eyebrow">New administrative project</p><h1 className="mt-4 text-4xl font-semibold">What are you creating?</h1><div className="mt-8 grid gap-4 sm:grid-cols-2"><Link className="rounded-2xl border p-6" href="/admin/projects/new?type=sample"><h2 className="font-semibold">Official sample site</h2><p className="mt-2 text-sm text-slate-600">Creates a LaunchSite-managed project and marks it for Examples.</p></Link><Link className="rounded-2xl border p-6" href="/admin/projects/new?type=project"><h2 className="font-semibold">Admin-owned project</h2><p className="mt-2 text-sm text-slate-600">Creates a regular private project owned by the administrator.</p></Link></div></section>;
  return <CreateWizard adminSample={type === "sample"} />;
}
