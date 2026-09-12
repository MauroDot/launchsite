import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadStatusForm } from "@/components/lead-status-form";
import { getUserLead } from "@/lib/leads/service";
export const dynamic = "force-dynamic";
export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) { const lead = await getUserLead((await params).id); if (!lead) notFound(); return <section className="mx-auto max-w-3xl px-5 py-12"><Link className="text-sm font-semibold underline" href="/dashboard/leads">← All leads</Link><h1 className="mt-6 text-4xl font-semibold">{lead.name}</h1><p className="mt-2 text-slate-600">{lead.email}{lead.phone ? ` · ${lead.phone}` : ""} · {lead.project.businessName}</p><div className="mt-8 rounded-2xl border p-6"><p className="whitespace-pre-wrap leading-7">{lead.message}</p><p className="mt-6 text-xs text-slate-500">Received {lead.createdAt.toLocaleString()}</p><div className="mt-6 border-t pt-5"><LeadStatusForm id={lead.id} initial={lead.status} /></div></div></section>; }
