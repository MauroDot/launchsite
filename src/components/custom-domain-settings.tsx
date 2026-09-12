"use client";

import { useState, useTransition } from "react";
import { checkDomainAction, connectDomainAction, disconnectDomainAction } from "@/app/actions/domains";

type Domain = { id: string; projectId: string; hostname: string; canonical: boolean; status: string; verifiedAt: Date | string | null; verification?: unknown };

function dnsRecords(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const source = value as { verification?: unknown; recommendedCnames?: Array<{ name?: string; value?: string }>; recommendedAValues?: string[] };
  const records = Array.isArray(source.verification) ? source.verification : [];
  return [...records, ...(source.recommendedCnames ?? []).map((record) => ({ type: "CNAME", domain: record.name, value: record.value })), ...(source.recommendedAValues ?? []).map((value) => ({ type: "A", value }))].filter((record): record is { type?: string; domain?: string; value?: string } => Boolean(record && typeof record === "object"));
}

export function CustomDomainSettings({ projectId, isPublished, canUseCustomDomain, initialDomain }: { projectId: string; isPublished: boolean; canUseCustomDomain: boolean; initialDomain: Domain | null }) {
  const [domain, setDomain] = useState(initialDomain);
  const [hostname, setHostname] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const run = (task: () => Promise<{ ok: boolean; error?: string; domain?: unknown }>, success: string) => startTransition(async () => { setMessage(""); const result = await task(); if (result.ok) { if (result.domain) setDomain(result.domain as Domain); setHostname(""); setMessage(success); } else setMessage(result.error ?? "The domain action could not be completed."); });
  if (!canUseCustomDomain) return <section className="mt-8 rounded-2xl border border-slate-200 p-6"><h2 className="text-xl font-semibold">Custom domain</h2><p className="mt-2 text-sm text-slate-600">Custom domains are available on a paid plan.</p><a className="mt-4 inline-block rounded-full border px-4 py-2 text-sm font-semibold" href="/pricing">View plans</a></section>;
  const records = dnsRecords(domain?.verification);
  return <section className="mt-8 rounded-2xl border border-slate-200 p-6"><h2 className="text-xl font-semibold">Custom domain</h2>{!isPublished ? <p className="mt-2 text-sm text-slate-600">Publish this site before connecting a custom domain. Your LaunchSite URL remains available.</p> : domain ? <><p className="mt-3 font-semibold">{domain.hostname}</p><p className="mt-1 text-sm text-slate-600">Status: {domain.status === "ACTIVE" ? "Connected" : domain.status === "ERROR" ? "Needs attention" : "Waiting for DNS"}</p>{records.length > 0 && <div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="font-semibold">Required DNS records</p>{records.map((record, index) => <p className="mt-2 text-sm" key={index}>{record.type ?? "Record"} {record.domain ?? ""} → {record.value ?? ""}</p>)}</div>}<div className="mt-5 flex flex-wrap gap-3"><button className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white" disabled={pending} onClick={() => run(() => checkDomainAction(projectId), "Connection status refreshed.")} type="button">Check connection</button><button className="rounded-full border px-4 py-2 text-sm font-semibold" disabled={pending} onClick={() => run(async () => { const result = await disconnectDomainAction(projectId); return result.ok ? { ...result, domain: null } : result; }, "Domain disconnected.")} type="button">Disconnect</button></div></> : <><label className="mt-4 block text-sm font-medium">Hostname<input className="mt-2 w-full rounded border p-3" onChange={(event) => setHostname(event.target.value)} placeholder="example.com" value={hostname} /></label><p className="mt-2 text-xs text-slate-500">Enter a hostname only, without https://, paths, or ports.</p><button className="mt-5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white" disabled={pending || !hostname.trim()} onClick={() => run(() => connectDomainAction(projectId, hostname), "Domain connection started. Configure the DNS records shown after checking the connection.")} type="button">Connect domain</button></>}{message && <p className="mt-4 text-sm" role="status">{message}</p>}</section>;
}
