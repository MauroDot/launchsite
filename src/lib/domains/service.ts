import "server-only";
import { getUserEntitlements } from "@/lib/billing/entitlements";
import { requireProjectAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { addProjectDomain, getDomainConfiguration, getProjectDomain, removeProjectDomain, statusFromVercel } from "./vercel";
import { normalizeDomainHostname } from "./validation";
import { getAppUrl } from "@/lib/app-url";

type DomainRecord = { id: string; projectId: string; hostname: string; canonical: boolean; status: "PENDING" | "VERIFYING" | "ACTIVE" | "ERROR" | "DISCONNECTED"; verifiedAt: Date | null; verification?: unknown };

function publicDomain(domain: DomainRecord, verification?: unknown) {
  return { id: domain.id, projectId: domain.projectId, hostname: domain.hostname, canonical: domain.canonical, status: domain.status, verifiedAt: domain.verifiedAt, verification: verification ?? null };
}

async function ownedCustomerProject(projectId: string) {
  const user = await requireProjectAccess(projectId);
  const project = await prisma.websiteProject.findUnique({ where: { id: projectId }, select: { id: true, userId: true, isPublished: true, isDemo: true } });
  if (!project || project.userId !== user.id || project.isDemo) throw new Error("Custom domains are available only for your published customer sites.");
  return { user, project };
}

export async function getProjectDomainForUser(projectId: string) {
  const { user, project } = await ownedCustomerProject(projectId);
  const domain = await prisma.domain.findUnique({ where: { projectId }, select: { id: true, projectId: true, hostname: true, canonical: true, status: true, verifiedAt: true } });
  return { user, project, domain: domain ? publicDomain(domain as DomainRecord) : null };
}

export async function connectProjectDomain(projectId: string, input: unknown) {
  const { user, project } = await ownedCustomerProject(projectId);
  if (!project.isPublished) throw new Error("Publish this site before connecting a custom domain.");
  const entitlement = await getUserEntitlements(user.id);
  if (!entitlement.canUseCustomDomain) throw new Error("Custom domains require an active paid plan.");
  const hostname = normalizeDomainHostname(input);
  const existing = await prisma.domain.findFirst({ where: { OR: [{ hostname }, { projectId }] }, select: { id: true, projectId: true, hostname: true } });
  if (existing) {
    if (existing.projectId !== projectId) throw new Error("That hostname is already connected to another site.");
    if (existing.hostname !== hostname) throw new Error("Disconnect the current domain before connecting a different hostname.");
    throw new Error("That domain is already connected. Use Check connection to refresh it.");
  }
  const pending = await prisma.domain.create({ data: { projectId, hostname, canonical: false, status: "PENDING" }, select: { id: true, projectId: true, hostname: true, canonical: true, status: true, verifiedAt: true } });
  try {
    const provider = await addProjectDomain(hostname);
    const status = statusFromVercel(provider);
    const updated = await prisma.domain.update({ where: { id: pending.id }, data: { status, verifiedAt: status === "ACTIVE" ? new Date() : null }, select: { id: true, projectId: true, hostname: true, canonical: true, status: true, verifiedAt: true } });
    return publicDomain(updated as DomainRecord, provider.verification);
  } catch (error) {
    await prisma.domain.delete({ where: { id: pending.id } }).catch(() => undefined);
    throw error;
  }
}

export async function refreshProjectDomain(projectId: string) {
  await ownedCustomerProject(projectId);
  const local = await prisma.domain.findUnique({ where: { projectId }, select: { id: true, projectId: true, hostname: true, canonical: true, status: true, verifiedAt: true } });
  if (!local) throw new Error("No custom domain is connected to this site.");
  const [provider, configuration] = await Promise.all([getProjectDomain(local.hostname), getDomainConfiguration(local.hostname).catch(() => null)]);
  const status = statusFromVercel(provider);
  const updated = await prisma.domain.update({ where: { id: local.id }, data: { status, verifiedAt: status === "ACTIVE" ? new Date() : null }, select: { id: true, projectId: true, hostname: true, canonical: true, status: true, verifiedAt: true } });
  return publicDomain(updated as DomainRecord, configuration ?? provider.verification);
}

export async function disconnectProjectDomain(projectId: string) {
  await ownedCustomerProject(projectId);
  const local = await prisma.domain.findUnique({ where: { projectId }, select: { id: true, hostname: true } });
  if (!local) throw new Error("No custom domain is connected to this site.");
  if (local.hostname === new URL(getAppUrl()).hostname || local.hostname.endsWith(".vercel.app") || local.hostname.endsWith(".vercel.sh")) throw new Error("The canonical LaunchSite domain cannot be disconnected.");
  await removeProjectDomain(local.hostname);
  await prisma.domain.delete({ where: { id: local.id } });
}
