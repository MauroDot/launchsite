"use client";

import { useState } from "react";
import { saveFeaturedBusinessAction } from "@/app/actions/projects";
import type { FeaturedBusinessInput, FeaturedBusinessRecord } from "@/lib/project-repository";

function dateValue(value: Date | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export function FeaturedBusinessForm({ projectId, featured }: { projectId: string; featured: FeaturedBusinessRecord | null }) {
  const [settings, setSettings] = useState<FeaturedBusinessInput>({ enabled: featured?.enabled ?? false, displayTitle: featured?.displayTitle ?? "", promotionalDescription: featured?.promotionalDescription ?? "", imageUrl: featured?.imageUrl ?? "", sortOrder: featured?.sortOrder?.toString() ?? "", startsAt: dateValue(featured?.startsAt), endsAt: dateValue(featured?.endsAt) });
  const [message, setMessage] = useState("");
  const update = <K extends keyof FeaturedBusinessInput>(key: K, value: FeaturedBusinessInput[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const save = async () => { const result = await saveFeaturedBusinessAction(projectId, settings); setMessage(result.ok ? "Featured business settings saved." : result.error); };
  return <section className="mt-8 rounded-2xl border border-slate-200 p-6"><h2 className="text-xl font-semibold">Featured Business</h2><p className="mt-2 text-sm text-slate-600">A future paid/promoted placement. It is separate from LaunchSite demo examples.</p><div className="mt-5 grid gap-4"><label className="flex gap-3"><input checked={settings.enabled} onChange={(event) => update("enabled", event.target.checked)} type="checkbox" />Enable featured placement</label><label>Display title<input className="mt-1 w-full rounded border p-2" value={settings.displayTitle} onChange={(event) => update("displayTitle", event.target.value)} /></label><label>Promotional description<textarea className="mt-1 w-full rounded border p-2" value={settings.promotionalDescription} onChange={(event) => update("promotionalDescription", event.target.value)} /></label><label>Display image or logo URL<input className="mt-1 w-full rounded border p-2" value={settings.imageUrl} onChange={(event) => update("imageUrl", event.target.value)} /></label><div className="grid gap-4 sm:grid-cols-3"><label>Display order<input className="mt-1 w-full rounded border p-2" min="0" type="number" value={settings.sortOrder} onChange={(event) => update("sortOrder", event.target.value)} /></label><label>Starts<input className="mt-1 w-full rounded border p-2" type="date" value={settings.startsAt} onChange={(event) => update("startsAt", event.target.value)} /></label><label>Ends<input className="mt-1 w-full rounded border p-2" type="date" value={settings.endsAt} onChange={(event) => update("endsAt", event.target.value)} /></label></div></div><button className="mt-5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={save} type="button">Save featured business</button>{message && <p className="mt-3 text-sm" role="status">{message}</p>}</section>;
}
