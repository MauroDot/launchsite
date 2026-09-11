import { createWebsiteProject } from "@/lib/generate-site-content";
import { prisma } from "@/lib/prisma";
import { validateProjectInput } from "@/lib/project-validation";
import type { BrandTone, PersistedWebsiteProject, PrimaryCallToAction, VisualStyle, WebsiteProjectInput } from "@/lib/website-types";

type ProjectRecord = {
  id: string; createdAt: Date; updatedAt: Date; businessName: string; businessType: string; businessDescription: string;
  serviceArea: string; phone: string; email: string; yearsInBusiness: number | null; brandTone: string;
  primaryCallToAction: string; visualStyle: string; slug: string; status: "DRAFT"; services: Array<{ name: string; position: number }>;
};

function toProject(record: ProjectRecord): PersistedWebsiteProject {
  return {
    ...createWebsiteProject({
      business: {
        businessName: record.businessName, category: record.businessType, description: record.businessDescription,
        serviceArea: record.serviceArea, phone: record.phone, email: record.email, yearsInBusiness: record.yearsInBusiness?.toString() ?? "",
        tone: record.brandTone as BrandTone, callToAction: record.primaryCallToAction as PrimaryCallToAction,
        services: record.services.map((service) => service.name).join(", "),
      }, visualStyle: record.visualStyle as VisualStyle,
    }), id: record.id, slug: record.slug, status: record.status, createdAt: record.createdAt, updatedAt: record.updatedAt,
  };
}

function fieldsFor(input: WebsiteProjectInput) {
  const years = Number.parseInt(input.business.yearsInBusiness, 10);
  return { businessName: input.business.businessName.trim(), businessType: input.business.category.trim(), businessDescription: input.business.description.trim(), serviceArea: input.business.serviceArea.trim(), phone: input.business.phone.trim(), email: input.business.email.trim().toLowerCase(), yearsInBusiness: Number.isFinite(years) && years >= 0 ? years : null, brandTone: input.business.tone, primaryCallToAction: input.business.callToAction, visualStyle: input.visualStyle };
}

export async function createProject(input: WebsiteProjectInput): Promise<PersistedWebsiteProject> {
  const validated = validateProjectInput(input);
  if (!validated.valid) throw new Error(validated.message);
  const slug = `${input.business.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "website"}-${crypto.randomUUID().slice(0, 8)}`;
  const record = await prisma.websiteProject.create({ data: { ...fieldsFor(input), slug, services: { create: validated.services.map((name, position) => ({ name, position })) } }, include: { services: { orderBy: { position: "asc" } } } });
  return toProject(record as ProjectRecord);
}

export async function updateProject(id: string, input: WebsiteProjectInput): Promise<PersistedWebsiteProject> {
  const validated = validateProjectInput(input);
  if (!validated.valid) throw new Error(validated.message);
  const record = await prisma.websiteProject.update({ where: { id }, data: { ...fieldsFor(input), services: { deleteMany: {}, create: validated.services.map((name, position) => ({ name, position })) } }, include: { services: { orderBy: { position: "asc" } } } });
  return toProject(record as ProjectRecord);
}

export async function getProject(id: string) {
  const record = await prisma.websiteProject.findUnique({ where: { id }, include: { services: { orderBy: { position: "asc" } } } });
  return record ? toProject(record as ProjectRecord) : null;
}

export async function listProjects() {
  const records = await prisma.websiteProject.findMany({ orderBy: { updatedAt: "desc" }, include: { services: { orderBy: { position: "asc" } } } });
  return records.map((record) => toProject(record as ProjectRecord));
}
