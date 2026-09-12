import "server-only";

type VercelDomain = { name?: string; verified?: boolean; misconfigured?: boolean; verification?: Array<{ type?: string; domain?: string; value?: string }> };

function config() {
  const token = process.env.VERCEL_API_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  if (!token || !projectId) throw new Error("Custom domains are not configured yet.");
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID?.trim() };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { token, projectId, teamId } = config();
  const url = new URL(`https://api.vercel.com${path.replace("{projectId}", encodeURIComponent(projectId))}`);
  if (teamId) url.searchParams.set("teamId", teamId);
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | T;
  if (!response.ok) throw new Error((body as { error?: { message?: string } })?.error?.message || `Vercel domain request failed (${response.status}).`);
  return body as T;
}

export function addProjectDomain(hostname: string) {
  return request<VercelDomain>("/v10/projects/{projectId}/domains", { method: "POST", body: JSON.stringify({ name: hostname }) });
}

export function getProjectDomain(hostname: string) {
  return request<VercelDomain>(`/v9/projects/{projectId}/domains/${encodeURIComponent(hostname)}`);
}

export function getDomainConfiguration(hostname: string) {
  return request<VercelDomain>(`/v6/domains/${encodeURIComponent(hostname)}/config`);
}

export function removeProjectDomain(hostname: string) {
  return request<unknown>(`/v9/projects/{projectId}/domains/${encodeURIComponent(hostname)}`, { method: "DELETE" });
}

export function statusFromVercel(domain: VercelDomain) {
  if (domain.verified) return "ACTIVE" as const;
  if (domain.misconfigured) return "ERROR" as const;
  return "VERIFYING" as const;
}

export type { VercelDomain };
