"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { publishProjectAction, unpublishProjectAction } from "@/app/actions/projects";

type Props = { projectId: string; businessName: string; isPublished: boolean; publicSlug?: string };

export function PublishSiteControls({ projectId, businessName, isPublished, publicSlug }: Props) {
  const [slug, setSlug] = useState(publicSlug ?? businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const publish = () => startTransition(async () => { const result = await publishProjectAction(projectId, slug); setMessage(result.ok ? "Your saved website is live. Future saved edits appear here immediately." : result.error); if (result.ok) router.refresh(); });
  const unpublish = () => startTransition(async () => { const result = await unpublishProjectAction(projectId); setMessage(result.ok ? "Your website is no longer public. Your project remains private in LaunchSite." : result.error); if (result.ok) router.refresh(); });
  return <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{isPublished ? "Your website is published" : "Publish your website"}</p><p className="mt-1 text-sm text-slate-600">{isPublished ? "Saved website edits are live immediately." : "Choose the public address customers will visit."}</p></div>{isPublished && publicSlug && <Link className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold" href={`/site/${publicSlug}`} target="_blank">View live site</Link>}</div><label className="mt-4 block text-sm font-medium text-slate-700">Public URL <span className="font-normal text-slate-500">launchsite.app/site/</span><input aria-label="Public website URL" className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2" disabled={pending} onChange={(event) => setSlug(event.target.value)} value={slug} /></label><div className="mt-4 flex flex-wrap gap-3"><button className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} onClick={publish} type="button">{pending ? "Saving…" : isPublished ? "Update published site" : "Publish site"}</button>{isPublished && <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60" disabled={pending} onClick={unpublish} type="button">Unpublish</button>}</div>{message && <p aria-live="polite" className="mt-3 text-sm text-slate-600">{message}</p>}</section>;
}
