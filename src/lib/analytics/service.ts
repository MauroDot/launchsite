import "server-only";
import type { AnalyticsEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppUrl } from "@/lib/app-url";
import { requireProjectAccess } from "@/lib/access";
import { validatePublicSlug } from "@/lib/public-slug";

export type AnalyticsHost = "LAUNCHSITE_SLUG" | "CUSTOM_DOMAIN";

function hostnameOf(host: string | null) { return host?.split(":", 1)[0]?.toLowerCase().replace(/\.$/, "") || null; }
function canonicalHostname() { try { return new URL(getAppUrl()).hostname; } catch { return "launchsite-two.vercel.app"; } }
function isCustomHost(host: string | null) { const value = hostnameOf(host); return Boolean(value && value !== canonicalHostname() && value !== "localhost" && value !== "127.0.0.1" && !value.endsWith(".vercel.app") && !value.endsWith(".vercel.sh")); }

export function classifyReferrer(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return { source: "DIRECT", referrer: null };
  try {
    const url = new URL(value); const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname.includes("google.")) return { source: "GOOGLE", referrer: hostname };
    if (hostname.includes("bing.")) return { source: "BING", referrer: hostname };
    if (hostname === "facebook.com" || hostname.endsWith(".facebook.com")) return { source: "FACEBOOK", referrer: hostname };
    if (hostname === "instagram.com" || hostname.endsWith(".instagram.com")) return { source: "INSTAGRAM", referrer: hostname };
    if (hostname === "yelp.com" || hostname.endsWith(".yelp.com")) return { source: "YELP", referrer: hostname };
    if (/search\.|duckduckgo\.|ecosia\.|yahoo\./.test(hostname)) return { source: "OTHER_SEARCH", referrer: hostname };
    if (/tiktok\.|x\.com$|twitter\.|linkedin\.|pinterest\./.test(hostname)) return { source: "OTHER_SOCIAL", referrer: hostname };
    return { source: "OTHER_REFERRAL", referrer: hostname };
  } catch { return { source: "DIRECT", referrer: null }; }
}

async function resolvePublishedProject(slug: string, host: string | null) {
  const hostname = hostnameOf(host);
  if (!validatePublicSlug(slug)) return null;
  if (isCustomHost(host)) {
    const domain = await prisma.domain.findUnique({ where: { hostname: hostname! }, select: { status: true, project: { select: { id: true, publicSlug: true, isPublished: true } } } });
    if (!domain || domain.status !== "ACTIVE" || !domain.project.isPublished || domain.project.publicSlug !== slug) return null;
    return { id: domain.project.id, hostType: "CUSTOM_DOMAIN" as const };
  }
  const project = await prisma.websiteProject.findFirst({ where: { publicSlug: slug, isPublished: true }, select: { id: true } });
  return project ? { id: project.id, hostType: "LAUNCHSITE_SLUG" as const } : null;
}

function validPath(value: unknown) { return typeof value === "string" && value.startsWith("/") && value.length <= 500 && !value.includes("?") && !value.includes("#") && !value.startsWith("/api") && !value.startsWith("/dashboard") && !value.startsWith("/admin") && !value.startsWith("/login") && !value.startsWith("/signup") && !value.startsWith("/register"); }

export async function recordPublicPageView(payload: unknown, host: string | null) {
  if (!payload || typeof payload !== "object") throw new Error("Invalid analytics payload.");
  const value = payload as { slug?: unknown; path?: unknown; referrer?: unknown; visitorKey?: unknown };
  if (typeof value.slug !== "string" || !validPath(value.path)) throw new Error("Invalid analytics payload.");
  const path = value.path as string;
  if (value.visitorKey !== undefined && value.visitorKey !== null && (typeof value.visitorKey !== "string" || !/^[a-zA-Z0-9_-]{16,128}$/.test(value.visitorKey))) throw new Error("Invalid analytics payload.");
  const visitorKey = typeof value.visitorKey === "string" ? value.visitorKey : null;
  const project = await resolvePublishedProject(value.slug, host);
  if (!project) throw new Error("Published site not found.");
  const attribution = classifyReferrer(value.referrer);
  return prisma.analyticsEvent.create({ data: { projectId: project.id, type: "PAGE_VIEW", path, hostType: project.hostType, source: attribution.source, referrer: attribution.referrer, visitorKey }, select: { id: true } });
}

export async function recordLeadAnalytics(projectId: string) {
  try { await prisma.analyticsEvent.create({ data: { projectId, type: "LEAD_SUBMITTED", path: "/contact", hostType: "LAUNCHSITE_SLUG", source: "DIRECT" }, select: { id: true } }); }
  catch (error) { console.error("Lead analytics recording failed", { projectId, errorType: error instanceof Error ? error.name : "Unknown" }); }
}

export function summarizeAnalytics(events: Array<{ type: AnalyticsEventType; source: string | null; hostType: AnalyticsHost; visitorKey: string | null; createdAt: Date }>, days: number) {
  const since = Date.now() - days * 86400000; const recent = events.filter((event) => event.createdAt.getTime() >= since); const views = recent.filter((event) => event.type === "PAGE_VIEW"); const leads = recent.filter((event) => event.type === "LEAD_SUBMITTED");
  const visitors = new Set(views.map((event) => event.visitorKey).filter(Boolean)); const daily = new Map<string, { date: string; views: number; visitors: number; leads: number }>();
  for (let offset = days - 1; offset >= 0; offset -= 1) { const date = new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10); daily.set(date, { date, views: 0, visitors: 0, leads: 0 }); }
  for (const event of recent) { const day = daily.get(event.createdAt.toISOString().slice(0, 10)); if (!day) continue; if (event.type === "PAGE_VIEW") day.views += 1; else day.leads += 1; }
  const sourceCounts = new Map<string, number>(); for (const event of views) sourceCounts.set(event.source || "DIRECT", (sourceCounts.get(event.source || "DIRECT") ?? 0) + 1);
  const sources = [...sourceCounts.entries()].map(([source, count]) => ({ source, views: count })).sort((a, b) => b.views - a.views);
  return { views: views.length, visitors: visitors.size, leads: leads.length, conversionRate: visitors.size ? leads.length / visitors.size : 0, sources, customDomainViews: views.filter((event) => event.hostType === "CUSTOM_DOMAIN").length, launchSiteViews: views.filter((event) => event.hostType === "LAUNCHSITE_SLUG").length, daily: [...daily.values()] };
}

export async function getProjectAnalytics(projectId: string) {
  await requireProjectAccess(projectId);
  const events = await prisma.analyticsEvent.findMany({ where: { projectId }, orderBy: { createdAt: "asc" }, select: { type: true, source: true, hostType: true, visitorKey: true, createdAt: true } });
  return { sevenDays: summarizeAnalytics(events, 7), thirtyDays: summarizeAnalytics(events, 30) };
}
