import { createWebsiteProject } from "@/lib/generate-site-content";
import { prisma } from "@/lib/prisma";
import { ProjectInputValidationError, validateProjectInput } from "@/lib/project-validation";
import { validateGeneratedContent } from "@/lib/generated-content";
import type { BrandTone, PersistedWebsiteProject, PrimaryCallToAction, StructuredWebsiteContent, VisualStyle, WebsiteProjectInput } from "@/lib/website-types";

type ProjectRecord = {
  id: string; createdAt: Date; updatedAt: Date; businessName: string; businessType: string; businessDescription: string;
  serviceArea: string; phone: string; email: string; yearsInBusiness: number | null; brandTone: string; businessStory: string | null; targetAudience: string | null; differentiators: string | null; customerPriorities: string | null; factualNotes: string | null;
  primaryCallToAction: string; secondaryCallToAction: string | null; visualStyle: string; slug: string; status: "DRAFT"; services: Array<{ name: string; description: string; notes: string | null; position: number }>; workSamples: Array<{ id: string; mediaType: "IMAGE" | "VIDEO"; mediaUrl: string; title: string; description: string; serviceCategory: string | null; locationNote: string | null; cloudinaryPublicId: string | null; width: number | null; height: number | null; duration: number | null; format: string | null; bytes: number | null; position: number }>; testimonials: Array<{ id: string; customerName: string; testimonialText: string; serviceType: string | null; locationNote: string | null; rating: number | null; position: number }>; generatedContent: unknown; contentGeneratedAt: Date | null;
};

function toProject(record: ProjectRecord): PersistedWebsiteProject {
  return {
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
    }), id: record.id, slug: record.slug, status: record.status, createdAt: record.createdAt, updatedAt: record.updatedAt,
    ...(validateGeneratedContent(record.generatedContent) ? { generatedContent: validateGeneratedContent(record.generatedContent)!, contentGeneratedAt: record.contentGeneratedAt ?? undefined } : {}),
  };
}

function fieldsFor(input: WebsiteProjectInput) {
  const years = Number.parseInt(input.business.yearsInBusiness, 10);
  return { businessName: input.business.businessName.trim(), businessType: input.business.category.trim(), businessDescription: input.business.description.trim(), businessStory: input.business.businessStory.trim() || null, targetAudience: input.business.targetAudience.trim() || null, differentiators: input.business.differentiators.trim() || null, customerPriorities: input.business.customerPriorities.trim() || null, factualNotes: input.business.factualNotes.trim() || null, serviceArea: input.business.serviceArea.trim(), phone: input.business.phone.trim(), email: input.business.email.trim().toLowerCase(), yearsInBusiness: Number.isFinite(years) && years >= 0 ? years : null, brandTone: input.business.tone, primaryCallToAction: input.business.callToAction, secondaryCallToAction: input.business.secondaryCallToAction.trim() || null, visualStyle: input.visualStyle };
}

export async function createProject(input: WebsiteProjectInput): Promise<PersistedWebsiteProject> {
  const validated = validateProjectInput(input);
  if (!validated.valid) throw new ProjectInputValidationError(validated.message, validated.workSampleErrors);
  const slug = `${input.business.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "website"}-${crypto.randomUUID().slice(0, 8)}`;
  const record = await prisma.websiteProject.create({ data: { ...fieldsFor(input), slug, services: { create: validated.services.map((service, position) => ({ name: service.name, description: service.description, notes: service.notes || null, position })) }, workSamples: { create: validated.workSamples.map((sample, position) => ({ mediaType: sample.mediaType, mediaUrl: sample.mediaUrl, title: sample.title, description: sample.description, serviceCategory: sample.serviceCategory || null, locationNote: sample.locationNote || null, cloudinaryPublicId: sample.cloudinaryPublicId || null, width: sample.width ?? null, height: sample.height ?? null, duration: sample.duration ?? null, format: sample.format || null, bytes: sample.bytes ?? null, position })) }, testimonials: { create: validated.testimonials.map((testimonial, position) => ({ customerName: testimonial.customerName, testimonialText: testimonial.testimonialText, serviceType: testimonial.serviceType || null, locationNote: testimonial.locationNote || null, rating: testimonial.rating ? Number(testimonial.rating) : null, position })) } }, include: { services: { orderBy: { position: "asc" } }, workSamples: { orderBy: { position: "asc" } }, testimonials: { orderBy: { position: "asc" } } } } as never);
  return toProject(record as unknown as ProjectRecord);
}

export async function updateProject(id: string, input: WebsiteProjectInput): Promise<PersistedWebsiteProject> {
  const validated = validateProjectInput(input);
  if (!validated.valid) throw new ProjectInputValidationError(validated.message, validated.workSampleErrors);
  const record = await prisma.websiteProject.update({ where: { id }, data: { ...fieldsFor(input), services: { deleteMany: {}, create: validated.services.map((service, position) => ({ name: service.name, description: service.description, notes: service.notes || null, position })) }, workSamples: { deleteMany: {}, create: validated.workSamples.map((sample, position) => ({ mediaType: sample.mediaType, mediaUrl: sample.mediaUrl, title: sample.title, description: sample.description, serviceCategory: sample.serviceCategory || null, locationNote: sample.locationNote || null, cloudinaryPublicId: sample.cloudinaryPublicId || null, width: sample.width ?? null, height: sample.height ?? null, duration: sample.duration ?? null, format: sample.format || null, bytes: sample.bytes ?? null, position })) }, testimonials: { deleteMany: {}, create: validated.testimonials.map((testimonial, position) => ({ customerName: testimonial.customerName, testimonialText: testimonial.testimonialText, serviceType: testimonial.serviceType || null, locationNote: testimonial.locationNote || null, rating: testimonial.rating ? Number(testimonial.rating) : null, position })) } }, include: { services: { orderBy: { position: "asc" } }, workSamples: { orderBy: { position: "asc" } }, testimonials: { orderBy: { position: "asc" } } } } as never);
  return toProject(record as unknown as ProjectRecord);
}

export async function getProject(id: string) {
  const record = await prisma.websiteProject.findUnique({ where: { id }, include: { services: { orderBy: { position: "asc" } }, workSamples: { orderBy: { position: "asc" } }, testimonials: { orderBy: { position: "asc" } } } } as never);
  return record ? toProject(record as unknown as ProjectRecord) : null;
}

export async function listProjects() {
  const records = await prisma.websiteProject.findMany({ orderBy: { updatedAt: "desc" }, include: { services: { orderBy: { position: "asc" } }, workSamples: { orderBy: { position: "asc" } }, testimonials: { orderBy: { position: "asc" } } } } as never);
  return records.map((record) => toProject(record as unknown as ProjectRecord));
}

export async function saveGeneratedContent(id: string, content: StructuredWebsiteContent) {
  await prisma.websiteProject.update({ where: { id }, data: { generatedContent: JSON.parse(JSON.stringify(content)), contentGeneratedAt: new Date() } as never });
}
