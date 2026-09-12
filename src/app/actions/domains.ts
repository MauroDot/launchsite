"use server";

import { revalidatePath } from "next/cache";
import { connectProjectDomain, disconnectProjectDomain, refreshProjectDomain } from "@/lib/domains/service";

type DomainActionResult = { ok: true; domain?: unknown } | { ok: false; error: string };
function failure(error: unknown): DomainActionResult { return { ok: false, error: error instanceof Error ? error.message : "The domain action could not be completed." }; }

export async function connectDomainAction(projectId: string, hostname: unknown): Promise<DomainActionResult> {
  try { const domain = await connectProjectDomain(projectId, hostname); revalidatePath(`/dashboard/projects/${projectId}`); return { ok: true, domain }; } catch (error) { return failure(error); }
}
export async function checkDomainAction(projectId: string): Promise<DomainActionResult> {
  try { const domain = await refreshProjectDomain(projectId); revalidatePath(`/dashboard/projects/${projectId}`); return { ok: true, domain }; } catch (error) { return failure(error); }
}
export async function disconnectDomainAction(projectId: string): Promise<DomainActionResult> {
  try { await disconnectProjectDomain(projectId); revalidatePath(`/dashboard/projects/${projectId}`); return { ok: true }; } catch (error) { return failure(error); }
}
