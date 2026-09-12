"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { publishProjectAction, unpublishProjectAction } from "@/app/actions/projects";
import { normalizePublicSlug, validatePublicSlug } from "@/lib/public-slug";

type Props = { projectId: string; businessName: string; isPublished: boolean; publicSlug?: string };

export function PublishSiteControls({ projectId, businessName, isPublished, publicSlug }: Props) {
  const suggestion = validatePublicSlug(normalizePublicSlug(businessName)) ?? "website";
  const [slug, setSlug] = useState(publicSlug ?? suggestion);
  const [edited, setEdited] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const publish = () => startTransition(async () => {
    try {
      const result = await publishProjectAction(projectId, edited ? slug : undefined);
      setMessage(result.ok ? "Your saved website is live. Saved edits appear on the live site immediately." : result.error);
      if (result.ok) { setSlug(result.publicSlug ?? slug); setEdited(false); router.refresh(); }
    } catch { setMessage("We couldn't reach LaunchSite. Please try again."); }
  });
  const unpublish = () => startTransition(async () => {
    try {
      const result = await unpublishProjectAction(projectId);
      setMessage(result.ok ? "Your /site/ address is no longer public. Your project and address are preserved." : result.error);
      if (result.ok) router.refresh();
    } catch { setMessage("We couldn't reach LaunchSite. Please try again."); }
  });
  return <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div>
      <h2 className="text-sm font-semibold text-slate-900">{isPublished ? "Your website is published" : "Publish your website"}</h2>
      <p className="mt-1 text-sm text-slate-600">Publishing shares your saved website. Future saved edits go live immediately. Unsaved changes stay private.</p>
    </div>{isPublished && publicSlug && <Link className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold" href={`/site/${publicSlug}`} target="_blank" rel="noopener noreferrer">View live site</Link>}</div>
    <label className="mt-4 block text-sm font-medium text-slate-700">Public address <span className="font-normal text-slate-500">/site/</span>
      <input aria-describedby={`slug-help-${projectId}`} autoCapitalize="none" spellCheck={false} maxLength={72} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2" disabled={pending} onChange={(event) => { setSlug(event.target.value); setEdited(true); }} value={slug} />
    </label>
    <p className="mt-2 text-xs text-slate-500" id={`slug-help-${projectId}`}>Use 3-72 lowercase letters, numbers, and single hyphens. Suggested addresses receive a number if already taken. Changing a live address makes the old link unavailable.</p>
    {publicSlug && <p className="mt-2 break-all text-sm text-slate-600">{isPublished ? "Live" : "Reserved"}: /site/{publicSlug}</p>}
    <div className="mt-4 flex flex-wrap gap-3"><button className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={pending || (isPublished && !edited)} onClick={publish} type="button">{pending ? "Saving..." : isPublished ? "Save public address" : "Publish site"}</button>
      {isPublished && <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60" disabled={pending} onClick={unpublish} type="button">Unpublish</button>}
    </div>
    <p aria-live="polite" className="mt-3 text-sm text-slate-600">{message}</p>
  </section>;
}
