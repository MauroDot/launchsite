import "server-only";
import type { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/access";
import { validatePublicSlug } from "@/lib/public-slug";
import { notifyLead } from "./email";
import { validateLeadInput } from "./validation";
import { selectLeadNotificationRecipient } from "./recipient";

function hostnameOf(host: string | null) { return host?.split(":", 1)[0]?.toLowerCase().replace(/\.$/, "") || null; }

async function resolveProject(slug: string | null, host: string | null) {
  const hostname = hostnameOf(host);
  const canonicalHost = (() => { try { return new URL(process.env.NEXT_PUBLIC_APP_URL || "https://launchsite-two.vercel.app").hostname; } catch { return "launchsite-two.vercel.app"; } })();
  const custom = hostname && hostname !== canonicalHost && !hostname.endsWith(".vercel.app") && !hostname.endsWith(".vercel.sh") && hostname !== "localhost" && hostname !== "127.0.0.1";
  if (custom) {
    const domain = await prisma.domain.findUnique({ where: { hostname }, select: { status: true, project: { select: { id: true, publicSlug: true, isPublished: true, businessName: true, email: true, user: { select: { email: true } } } } } });
    if (!domain || domain.status !== "ACTIVE" || !domain.project.isPublished) return null;
    if (slug && slug !== domain.project.publicSlug) return null;
    return domain.project;
  }
  if (!slug || !validatePublicSlug(slug)) return null;
  return prisma.websiteProject.findFirst({ where: { publicSlug: slug, isPublished: true }, select: { id: true, publicSlug: true, isPublished: true, businessName: true, email: true, user: { select: { email: true } } } });
}

export async function createPublicLead(payload: unknown, host: string | null) {
  const input = validateLeadInput(payload);
  const project = await resolveProject(input.slug, host);
  if (!project) throw new Error("This website is not accepting messages.");
  const lead = await prisma.lead.create({ data: { projectId: project.id, name: input.name, email: input.email, phone: input.phone, message: input.message, source: "CONTACT_FORM" }, select: { id: true, projectId: true, createdAt: true } });
  try { await notifyLead({ leadId: lead.id, projectId: lead.projectId, recipient: selectLeadNotificationRecipient(project), businessName: project.businessName, name: input.name, email: input.email, phone: input.phone, message: input.message }); }
  catch (error) { console.error("Lead notification final failure", { leadId: lead.id, projectId: lead.projectId, timestamp: new Date().toISOString(), errorType: error instanceof Error ? error.name : "Unknown" }); }
  return lead;
}

export async function listUserLeads() {
  const user = await requireUser();
  return prisma.lead.findMany({ where: { project: { userId: user.id } }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, email: true, phone: true, message: true, status: true, source: true, createdAt: true, project: { select: { id: true, businessName: true } } } });
}

export async function getUserLead(id: string) {
  const user = await requireUser();
  return prisma.lead.findFirst({ where: { id, project: { userId: user.id } }, select: { id: true, name: true, email: true, phone: true, message: true, status: true, source: true, createdAt: true, updatedAt: true, project: { select: { id: true, businessName: true } } } });
}

export async function updateUserLeadStatus(id: string, status: unknown) {
  const user = await requireUser();
  if (!["NEW", "CONTACTED", "CLOSED", "SPAM"].includes(String(status))) throw new Error("Choose a valid lead status.");
  const lead = await prisma.lead.findFirst({ where: { id, project: { userId: user.id } }, select: { id: true } });
  if (!lead) throw new Error("Lead not found.");
  return prisma.lead.update({ where: { id }, data: { status: status as LeadStatus }, select: { id: true, status: true } });
}
