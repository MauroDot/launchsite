import { createWebsiteProject } from "@/lib/generate-site-content";
import { prisma } from "@/lib/prisma";
import { ProjectInputValidationError, validateProjectInput } from "@/lib/project-validation";
import { validateGeneratedContent } from "@/lib/generated-content";
import { assertContentGroundedInProject } from "@/lib/content-grounding";
import { requireAdmin, requireProjectAccess, requireUser } from "@/lib/access";
import { defaultSiteSettings, defaultThemeSettings, siteSectionIds, type BrandTone, type PersistedWebsiteProject, type PrimaryCallToAction, type SiteSectionId, type SiteSettings, type StructuredWebsiteContent, type VisualStyle, type WebsiteProjectInput } from "@/lib/website-types";

type ProjectRecord = {
  id: string; createdAt: Date; updatedAt: Date; businessName: string; businessType: string; businessDescription: string;
  serviceArea: string; phone: string; email: string; yearsInBusiness: number | null; brandTone: string; businessStory: string | null; targetAudience: string | null; differentiators: string | null; customerPriorities: string | null; factualNotes: string | null;
  primaryCallToAction: string; secondaryCallToAction: string | null; visualStyle: string; slug: string; status: "DRAFT"; services: Array<{ name: string; description: string; notes: string | null; position: number }>; workSamples: Array<{ id: string; mediaType: "IMAGE" | "VIDEO"; mediaUrl: string; title: string; description: string; serviceCategory: string | null; locationNote: string | null; cloudinaryPublicId: string | null; width: number | null; height: number | null; duration: number | null; format: string | null; bytes: number | null; position: number }>; testimonials: Array<{ id: string; customerName: string; testimonialText: string; serviceType: string | null; locationNote: string | null; rating: number | null; position: number }>; generatedContent: unknown; contentGeneratedAt: Date | null; siteSettings: unknown; isDemo: boolean; featured: boolean; demoTitle: string | null; demoDescription: string | null; demoSortOrder: number | null;
};

function toProject(record: ProjectRecord): PersistedWebsiteProject {
  const savedSettings = record.siteSettings as Partial<SiteSettings> | null;
  const siteSettings: SiteSettings = { layoutFamily: savedSettings?.layoutFamily === "Conversion" || savedSettings?.layoutFamily === "Showcase" ? savedSettings.layoutFamily : "Classic", hiddenSections: (savedSettings?.hiddenSections ?? []).filter((section): section is SiteSectionId => siteSectionIds.includes(section as SiteSectionId)), sectionOrder: (savedSettings?.sectionOrder ?? defaultSiteSettings.sectionOrder).filter((section): section is SiteSectionId => siteSectionIds.includes(section as SiteSectionId)), theme: { ...defaultThemeSettings, ...(savedSettings?.theme ?? {}) } };
  const project: PersistedWebsiteProject = {
    ...createWebsiteProject({
      business: {
        businessName: record.businessName, category: record.businessType, description: record.businessDescription,
        serviceArea: record.serviceArea, phone: record.phone, email: record.email, yearsInBusiness: record.yearsInBusiness?.toString() ?? "",
        tone: record.brandTone as BrandTone, callToAction: record.primaryCallToAction as PrimaryCallToAction, secondaryCallToAction: record.secondaryCallToAction ?? "",
        businessStory: record.businessStory ?? "", targetAudience: record.targetAudience ?? "", differentiators: record.differentiators ?? "", customerPriorities: record.customerPriorities ?? "", factualNotes: record.factualNotes ?? "",
        services: record.services.map((service) => ({ id: `saved-${service.position}`, name: service.name, description: service.description, notes: service.notes ?? "" })),
      }, visualStyle: record.visualStyle as VisualStyle,
      workSamples: record.workSamples.map((sample) => ({ id: sample.id, mediaType: sample.mediaType, mediaUrl: sample.mediaUrl, title: sample.title, description: sample.description, serviceCategory: sample.serviceCategory ?? "", locationNote: sample.locationNote ?? "", cloudinaryPublicId: sample.cloudinaryPublicId ?? undefined, width: sample.width ?? undefined, height: sample.height ?? undefined, duration: sample.duration ?? undefined, format: sample.format ?? undefined, bytes: sample.bytes ?? undefined })),
      testimonials: record.testimonials.map((testimonial) => ({ id: testimonial.id, customerName: testimonial.customerName, testimonialText: testimonial.testimonialText, serviceType: testimonial.serviceType ?? "", locationNote: testimonial.locationNote ?? "", rating: testimonial.rating?.toString() ?? "" })),
    }), id: record.id, slug: record.slug, status: record.status, createdAt: record.createdAt, updatedAt: record.updatedAt, siteSettings, isDemo: record.isDemo, featured: record.featured, demoTitle: record.demoTitle ?? undefined, demoDescription: record.demoDescription ?? undefined, demoSortOrder: record.demoSortOrder ?? undefined,
  };
  const generatedContent = validateGeneratedContent(record.generatedContent);
  if (!generatedContent) return project;
  try {
    assertContentGroundedInProject(project, generatedContent);
    return { ...project, generatedContent, contentGeneratedAt: record.contentGeneratedAt ?? undefined };
  } catch (error) {
    console.warn("Ignoring generated content that is not grounded in its current project", { projectId: record.id, error: error instanceof Error ? error.message : "Unknown grounding error" });
    return project;
  }
}

function fieldsFor(input: WebsiteProjectInput) {
  const years = Number.parseInt(input.business.yearsInBusiness, 10);
  return { businessName: input.business.businessName.trim(), businessType: input.business.category.trim(), businessDescription: input.business.description.trim(), businessStory: input.business.businessStory.trim() || null, targetAudience: input.business.targetAudience.trim() || null, differentiators: input.business.differentiators.trim() || null, customerPriorities: input.business.customerPriorities.trim() || null, factualNotes: input.business.factualNotes.trim() || null, serviceArea: input.business.serviceArea.trim(), phone: input.business.phone.trim(), email: input.business.email.trim().toLowerCase(), yearsInBusiness: Number.isFinite(years) && years >= 0 ? years : null, brandTone: input.business.tone, primaryCallToAction: input.business.callToAction, secondaryCallToAction: input.business.secondaryCallToAction.trim() || null, visualStyle: input.visualStyle };
}

export async function createProject(input: WebsiteProjectInput): Promise<PersistedWebsiteProject> {
  const user = await requireUser();
  const validated = validateProjectInput(input);
  if (!validated.valid) throw new ProjectInputValidationError(validated.message, validated.workSampleErrors);
  const slug = `${input.business.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "website"}-${crypto.randomUUID().slice(0, 8)}`;
  const record = await prisma.websiteProject.create({ data: { ...fieldsFor(input), userId: user.id, slug, services: { create: validated.services.map((service, position) => ({ name: service.name, description: service.description, notes: service.notes || null, position })) }, workSamples: { create: validated.workSamples.map((sample, position) => ({ mediaType: sample.mediaType, mediaUrl: sample.mediaUrl, title: sample.title, description: sample.description, serviceCategory: sample.serviceCategory || null, locationNote: sample.locationNote || null, cloudinaryPublicId: sample.cloudinaryPublicId || null, width: sample.width ?? null, height: sample.height ?? null, duration: sample.duration ?? null, format: sample.format || null, bytes: sample.bytes ?? null, position })) }, testimonials: { create: validated.testimonials.map((testimonial, position) => ({ customerName: testimonial.customerName, testimonialText: testimonial.testimonialText, serviceType: testimonial.serviceType || null, locationNote: testimonial.locationNote || null, rating: testimonial.rating ? Number(testimonial.rating) : null, position })) } }, include: { services: { orderBy: { position: "asc" } }, workSamples: { orderBy: { position: "asc" } }, testimonials: { orderBy: { position: "asc" } } } } as never);
  return toProject(record as unknown as ProjectRecord);
}

export async function updateProject(id: string, input: WebsiteProjectInput): Promise<PersistedWebsiteProject> {
  await requireProjectAccess(id);
  const validated = validateProjectInput(input);
  if (!validated.valid) throw new ProjectInputValidationError(validated.message, validated.workSampleErrors);
  const record = await prisma.websiteProject.update({ where: { id }, data: { ...fieldsFor(input), services: { deleteMany: {}, create: validated.services.map((service, position) => ({ name: service.name, description: service.description, notes: service.notes || null, position })) }, workSamples: { deleteMany: {}, create: validated.workSamples.map((sample, position) => ({ mediaType: sample.mediaType, mediaUrl: sample.mediaUrl, title: sample.title, description: sample.description, serviceCategory: sample.serviceCategory || null, locationNote: sample.locationNote || null, cloudinaryPublicId: sample.cloudinaryPublicId || null, width: sample.width ?? null, height: sample.height ?? null, duration: sample.duration ?? null, format: sample.format || null, bytes: sample.bytes ?? null, position })) }, testimonials: { deleteMany: {}, create: validated.testimonials.map((testimonial, position) => ({ customerName: testimonial.customerName, testimonialText: testimonial.testimonialText, serviceType: testimonial.serviceType || null, locationNote: testimonial.locationNote || null, rating: testimonial.rating ? Number(testimonial.rating) : null, position })) } }, include: { services: { orderBy: { position: "asc" } }, workSamples: { orderBy: { position: "asc" } }, testimonials: { orderBy: { position: "asc" } } } } as never);
  return toProject(record as unknown as ProjectRecord);
}

export async function getProject(id: string) {
  await requireProjectAccess(id);
  const record = await prisma.websiteProject.findUnique({ where: { id }, include: { services: { orderBy: { position: "asc" } }, workSamples: { orderBy: { position: "asc" } }, testimonials: { orderBy: { position: "asc" } } } } as never);
  return record ? toProject(record as unknown as ProjectRecord) : null;
}

export async function listProjects() {
  const user = await requireUser();
  const records = await prisma.websiteProject.findMany({ where: { userId: user.id, isDemo: false }, orderBy: { updatedAt: "desc" }, include: { services: { orderBy: { position: "asc" } }, workSamples: { orderBy: { position: "asc" } }, testimonials: { orderBy: { position: "asc" } } } } as never);
  return records.map((record) => toProject(record as unknown as ProjectRecord));
}

export async function saveGeneratedContent(id: string, content: StructuredWebsiteContent) {
  await requireProjectAccess(id);
  await prisma.websiteProject.update({ where: { id }, data: { generatedContent: JSON.parse(JSON.stringify(content)), contentGeneratedAt: new Date() } as never });
}

export async function listDemoProjects(featuredOnly = false) {
  const records = await prisma.websiteProject.findMany({ where: { isDemo: true, ...(featuredOnly ? { featured: true } : {}) }, orderBy: [{ demoSortOrder: "asc" }, { updatedAt: "desc" }], include: { services: { orderBy: { position: "asc" } }, workSamples: { orderBy: { position: "asc" } }, testimonials: { orderBy: { position: "asc" } } } } as never);
  return (records as unknown as ProjectRecord[]).map(toProject);
}

export async function getDemoProject(slug: string) {
  const record = await prisma.websiteProject.findFirst({ where: { slug, isDemo: true }, include: { services: { orderBy: { position: "asc" } }, workSamples: { orderBy: { position: "asc" } }, testimonials: { orderBy: { position: "asc" } } } } as never);
  return record ? toProject(record as unknown as ProjectRecord) : null;
}

export async function saveSiteContent(id: string, content: StructuredWebsiteContent, siteSettings: SiteSettings) {
  await requireProjectAccess(id);
  const validated = validateGeneratedContent(content);
  if (!validated) throw new ProjectInputValidationError("Website content is incomplete or invalid.");
  if (![siteSettings.theme.primaryColor, siteSettings.theme.accentColor, siteSettings.theme.backgroundColor, siteSettings.theme.textColor, siteSettings.theme.mutedTextColor].every((color) => /^#[0-9a-fA-F]{6}$/.test(color)) || (siteSettings.theme.logoUrl && !/^https?:\/\//.test(siteSettings.theme.logoUrl))) throw new ProjectInputValidationError("Use valid six-digit HEX colors and an http or https logo URL.");
  await prisma.websiteProject.update({ where: { id }, data: { generatedContent: JSON.parse(JSON.stringify(validated)), siteSettings: JSON.parse(JSON.stringify(siteSettings)) } as never });
}

export async function saveDemoSettings(id: string, settings: import("@/lib/website-types").DemoSettings) {
  await requireAdmin();
  const sortOrder = settings.demoSortOrder.trim() === "" ? null : Number(settings.demoSortOrder);
  if (sortOrder !== null && (!Number.isInteger(sortOrder) || sortOrder < 0)) throw new ProjectInputValidationError("Display order must be a non-negative whole number.");
  await prisma.websiteProject.update({ where: { id }, data: { isDemo: settings.isDemo, featured: settings.isDemo && settings.featured, demoTitle: settings.demoTitle.trim() || null, demoDescription: settings.demoDescription.trim() || null, demoSortOrder: sortOrder } as never });
}

export type FeaturedBusinessInput = {
  enabled: boolean;
  displayTitle: string;
  promotionalDescription: string;
  imageUrl: string;
  sortOrder: string;
  startsAt: string;
  endsAt: string;
};

export type FeaturedBusinessRecord = Omit<FeaturedBusinessInput, "sortOrder"> & {
  id: string;
  projectId: string;
  sortOrder: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
};

type FeaturedBusinessDelegate = {
  upsert: (args: unknown) => Promise<unknown>;
  findUnique: (args: unknown) => Promise<FeaturedBusinessRecord | null>;
  findMany: (args: unknown) => Promise<Array<FeaturedBusinessRecord & { project: ProjectRecord }>>;
  count: (args?: unknown) => Promise<number>;
};

function featuredBusinessDelegate() {
  return (prisma as unknown as { featuredBusiness: FeaturedBusinessDelegate }).featuredBusiness;
}

export async function createAdminProject(input: WebsiteProjectInput, isDemo: boolean) {
  await requireAdmin();
  const project = await createProject(input);
  if (!isDemo) return project;
  await prisma.websiteProject.update({ where: { id: project.id }, data: { isDemo: true } });
  return { ...project, isDemo: true };
}

export async function listAdminProjects() {
  await requireAdmin();
  return prisma.websiteProject.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, businessName: true, businessType: true, isDemo: true, userId: true, updatedAt: true, featuredBusiness: { select: { enabled: true } } } } as never) as unknown as Promise<Array<{ id: string; businessName: string; businessType: string; isDemo: boolean; userId: string | null; updatedAt: Date; featuredBusiness: { enabled: boolean } | null }>>;
}

export async function getFeaturedBusiness(projectId: string) {
  await requireAdmin();
  return featuredBusinessDelegate().findUnique({ where: { projectId } });
}

function parseFeaturedInput(input: FeaturedBusinessInput) {
  const sortOrder = input.sortOrder.trim() === "" ? null : Number(input.sortOrder);
  if (sortOrder !== null && (!Number.isInteger(sortOrder) || sortOrder < 0)) throw new ProjectInputValidationError("Featured display order must be a non-negative whole number.");
  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime())) || (startsAt && endsAt && endsAt < startsAt)) throw new ProjectInputValidationError("Use valid featured start and end dates.");
  const imageUrl = input.imageUrl.trim();
  if (imageUrl && !/^https?:\/\//.test(imageUrl)) throw new ProjectInputValidationError("Use an http or https image URL.");
  return { enabled: input.enabled, displayTitle: input.displayTitle.trim() || null, promotionalDescription: input.promotionalDescription.trim() || null, imageUrl: imageUrl || null, sortOrder, startsAt, endsAt };
}

export async function saveFeaturedBusiness(projectId: string, input: FeaturedBusinessInput) {
  await requireAdmin();
  const project = await prisma.websiteProject.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new ProjectInputValidationError("Project not found.");
  const data = parseFeaturedInput(input);
  await featuredBusinessDelegate().upsert({ where: { projectId }, create: { projectId, ...data }, update: data });
}

export async function listPublicFeaturedBusinesses() {
  const now = new Date();
  const records = await featuredBusinessDelegate().findMany({ where: { enabled: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }], project: { isDemo: true } }, orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }], include: { project: { include: { services: { orderBy: { position: "asc" } }, workSamples: { orderBy: { position: "asc" } }, testimonials: { orderBy: { position: "asc" } } } } } });
  return records.map((record) => ({ ...record, project: toProject(record.project) }));
}

export async function getAdminOverview() {
  await requireAdmin();
  const [totalUsers, totalProjects, totalDemoSites, totalFeaturedBusinesses] = await Promise.all([prisma.user.count(), prisma.websiteProject.count(), prisma.websiteProject.count({ where: { isDemo: true } }), featuredBusinessDelegate().count({ where: { enabled: true } })]);
  return { totalUsers, totalProjects, totalDemoSites, totalFeaturedBusinesses };
}

export async function listAdminUsers() {
  await requireAdmin();
  return prisma.user.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, email: true, image: true, role: true, createdAt: true, _count: { select: { projects: true } } } });
}

export async function getAdminUserProjects(id: string) {
  await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true } });
  if (!user) return null;
  const projects = await prisma.websiteProject.findMany({ where: { userId: id }, orderBy: { updatedAt: "desc" }, select: { id: true, businessName: true, businessType: true, updatedAt: true, isDemo: true } });
  return { user, projects };
}

export async function changeUserRole(id: string, role: "USER" | "ADMIN") {
  const admin = await requireAdmin();
  if (id === admin.id) throw new ProjectInputValidationError("You cannot change your own administrator role.");
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target) throw new ProjectInputValidationError("User not found.");
  if (target.role === "ADMIN" && role === "USER" && await prisma.user.count({ where: { role: "ADMIN" } }) <= 1) throw new ProjectInputValidationError("LaunchSite must retain at least one administrator.");
  await prisma.user.update({ where: { id }, data: { role } });
}
