import "server-only";
import type { LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/access";
import { validatePublicSlug } from "@/lib/public-slug";
import { notifyLead } from "./email";
import { validateLeadInput } from "./validation";
import { selectLeadNotificationRecipient } from "./recipient";
import { recordLeadAnalytics } from "@/lib/analytics/service";

export const CRM_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"] as const;
export type CrmStatus = (typeof CRM_STATUSES)[number];
export type FollowUpFilter = "all" | "upcoming" | "overdue" | "none";
export type LeadListParams = { page?: number; search?: string; projectId?: string; status?: string; followUp?: FollowUpFilter; range?: "7" | "30" | "all"; sort?: "newest" | "oldest" | "followup" };
const PAGE_SIZE = 25;

function hostnameOf(host: string | null) { return host?.split(":", 1)[0]?.toLowerCase().replace(/\.$/, "") || null; }
async function resolveProject(slug: string | null, host: string | null) {
  const hostname = hostnameOf(host);
  const canonicalHost = (() => { try { return new URL(process.env.NEXT_PUBLIC_APP_URL || "https://launchsite-two.vercel.app").hostname; } catch { return "launchsite-two.vercel.app"; } })();
  const custom = hostname && hostname !== canonicalHost && !hostname.endsWith(".vercel.app") && !hostname.endsWith(".vercel.sh") && hostname !== "localhost" && hostname !== "127.0.0.1";
  if (custom) {
    const domain = await prisma.domain.findUnique({ where: { hostname }, select: { status: true, project: { select: { id: true, publicSlug: true, isPublished: true, businessName: true, email: true, user: { select: { email: true } } } } } });
    if (!domain || domain.status !== "ACTIVE" || !domain.project.isPublished || (slug && slug !== domain.project.publicSlug)) return null;
    return domain.project;
  }
  if (!slug || !validatePublicSlug(slug)) return null;
  return prisma.websiteProject.findFirst({ where: { publicSlug: slug, isPublished: true }, select: { id: true, publicSlug: true, isPublished: true, businessName: true, email: true, user: { select: { email: true } } } });
}

export async function createPublicLead(payload: unknown, host: string | null) {
  const input = validateLeadInput(payload); const project = await resolveProject(input.slug, host); if (!project) throw new Error("This website is not accepting messages.");
  const lead = await prisma.lead.create({ data: { projectId: project.id, name: input.name, email: input.email, phone: input.phone, message: input.message, source: "CONTACT_FORM", status: "NEW" }, select: { id: true, projectId: true, createdAt: true } });
  await recordLeadAnalytics(lead.projectId);
  try { await notifyLead({ leadId: lead.id, projectId: lead.projectId, recipient: selectLeadNotificationRecipient(project), businessName: project.businessName, name: input.name, email: input.email, phone: input.phone, message: input.message }); } catch (error) { console.error("Lead notification final failure", { leadId: lead.id, projectId: lead.projectId, timestamp: new Date().toISOString(), errorType: error instanceof Error ? error.name : "Unknown" }); }
  return lead;
}

type LeadWhere = Prisma.LeadWhereInput;
type LeadOrder = Prisma.LeadOrderByWithRelationInput | Prisma.LeadOrderByWithRelationInput[];
function listWhere(userId: string, params: LeadListParams, now = new Date()): LeadWhere {
  const and: LeadWhere[] = [{ project: { userId } }];
  const search = params.search?.trim();
  if (search) and.push({ OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }, { phone: { contains: search, mode: "insensitive" } }, { message: { contains: search, mode: "insensitive" } }] });
  if (params.projectId) and.push({ projectId: params.projectId });
  if (params.status && CRM_STATUSES.includes(params.status as CrmStatus)) and.push({ status: params.status as LeadStatus });
  if (params.range === "7" || params.range === "30") and.push({ createdAt: { gte: new Date(now.getTime() - Number(params.range) * 86400000) } });
  if (params.followUp === "upcoming") and.push({ followUpAt: { gte: now } });
  if (params.followUp === "overdue") and.push({ followUpAt: { lt: now } });
  if (params.followUp === "none") and.push({ followUpAt: null });
  return { AND: and };
}

export async function listUserLeads(params: LeadListParams = {}) {
  const user = await requireUser(); const page = Math.max(1, Math.floor(params.page || 1));
  const orderBy: LeadOrder = params.sort === "oldest" ? { createdAt: "asc" } : params.sort === "followup" ? [{ followUpAt: "asc" }, { createdAt: "desc" }] : { createdAt: "desc" };
  const where = listWhere(user.id, params);
  const [items, total] = await Promise.all([prisma.lead.findMany({ where, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: { id: true, name: true, email: true, phone: true, message: true, status: true, source: true, followUpAt: true, createdAt: true, project: { select: { id: true, businessName: true } } } }), prisma.lead.count({ where })]);
  return { items, total, page, pageSize: PAGE_SIZE, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}
export async function exportUserLeads(params: LeadListParams = {}) { const user = await requireUser(); return prisma.lead.findMany({ where: listWhere(user.id, params), orderBy: { createdAt: "desc" }, select: { name: true, email: true, phone: true, message: true, status: true, createdAt: true, followUpAt: true, project: { select: { businessName: true } } } }); }

export async function getUserLeadSummary() { const user = await requireUser(); const rows = await prisma.lead.groupBy({ by: ["status"], where: { project: { userId: user.id } }, _count: { _all: true } }); return Object.fromEntries(CRM_STATUSES.map((status) => [status, rows.find((row) => row.status === status)?._count._all ?? 0])); }

export async function getUserLead(id: string) { const user = await requireUser(); return prisma.lead.findFirst({ where: { id, project: { userId: user.id } }, select: { id: true, name: true, email: true, phone: true, message: true, status: true, source: true, followUpAt: true, createdAt: true, updatedAt: true, project: { select: { id: true, businessName: true } }, notes: { orderBy: { createdAt: "desc" }, select: { id: true, body: true, createdAt: true, updatedAt: true, userId: true } } } }); }

async function ownedLead(id: string, userId: string) { const lead = await prisma.lead.findFirst({ where: { id, project: { userId } }, select: { id: true } }); if (!lead) throw new Error("Lead not found."); return lead; }
export async function updateUserLeadStatus(id: string, status: unknown) { const user = await requireUser(); if (!CRM_STATUSES.includes(String(status) as CrmStatus)) throw new Error("Choose a valid lead status."); await ownedLead(id, user.id); return prisma.lead.update({ where: { id }, data: { status: status as LeadStatus }, select: { id: true, status: true } }); }
export async function updateUserLeadFollowUp(id: string, value: unknown) { const user = await requireUser(); await ownedLead(id, user.id); let followUpAt: Date | null = null; if (value) { const date = new Date(String(value)); if (Number.isNaN(date.getTime())) throw new Error("Choose a valid follow-up date."); followUpAt = date; } return prisma.lead.update({ where: { id }, data: { followUpAt }, select: { id: true, followUpAt: true } }); }
export async function addLeadNote(id: string, body: unknown) { const user = await requireUser(); await ownedLead(id, user.id); const text = typeof body === "string" ? body.trim() : ""; if (!text || text.length > 4000) throw new Error("Notes must be between 1 and 4,000 characters."); return prisma.leadNote.create({ data: { leadId: id, userId: user.id, body: text }, select: { id: true, body: true, createdAt: true, updatedAt: true, userId: true } }); }
async function ownedNote(id: string, userId: string) { const note = await prisma.leadNote.findFirst({ where: { id, lead: { project: { userId } } }, select: { id: true } }); if (!note) throw new Error("Note not found."); return note; }
export async function updateLeadNote(id: string, body: unknown) { const user = await requireUser(); await ownedNote(id, user.id); const text = typeof body === "string" ? body.trim() : ""; if (!text || text.length > 4000) throw new Error("Notes must be between 1 and 4,000 characters."); return prisma.leadNote.update({ where: { id }, data: { body: text }, select: { id: true, body: true, updatedAt: true } }); }
export async function deleteLeadNote(id: string) { const user = await requireUser(); await ownedNote(id, user.id); await prisma.leadNote.delete({ where: { id } }); }
