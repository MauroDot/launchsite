import Link from "next/link";
import { requireAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export default async function AdminPayments({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin();
  const page = Math.min(10000, Math.max(1, Number.parseInt((await searchParams).page || "1", 10) || 1));
  const projects = await prisma.websiteProject.findMany({ orderBy: { id: "asc" }, skip: (page - 1) * 25, take: 26, select: { id: true, businessName: true, paymentSettings: { select: { stripeConnectStatus: true, stripeChargesEnabled: true, stripePayoutsEnabled: true } }, _count: { select: { customerPayments: true } } } });
  const sources = await prisma.customerPayment.groupBy({ by: ["projectId", "paymentSource"], where: { projectId: { in: projects.slice(0, 25).map((p) => p.id) } }, _count: { _all: true } });
  return <section className="mx-auto max-w-5xl px-5 py-12"><Link className="underline" href="/admin">Back to admin</Link><h1 className="my-6 text-3xl font-semibold">Merchant payments</h1><p className="mb-6 text-sm text-slate-600">Read-only operational summary. Connected account eligibility comes from Stripe.</p><div className="grid gap-4 sm:grid-cols-2">{projects.slice(0, 25).map((project) => <article className="rounded-xl border p-5" key={project.id}><h2 className="font-semibold">{project.businessName}</h2><p className="mt-2 text-sm">{project.paymentSettings?.stripeConnectStatus.replaceAll("_", " ") ?? "Not connected"}</p><p className="mt-2 text-sm">{project._count.customerPayments} transactions · {sources.filter((s) => s.projectId === project.id).map((s) => `${s.paymentSource === "STRIPE" ? "Stripe" : "Manual"}: ${s._count._all}`).join(" · ") || "No payments"}</p></article>)}</div><div className="mt-6 flex gap-5">{page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}{projects.length > 25 && <Link href={`?page=${page + 1}`}>Next</Link>}</div></section>;
}
