import { brandTones, callToActions, visualStyles, type BusinessService, type Testimonial, type WebsiteProjectInput, type WorkSample } from "@/lib/website-types";

export type ProjectValidationResult = { valid: true; services: BusinessService[]; workSamples: WorkSample[]; testimonials: Testimonial[] } | { valid: false; message: string; workSampleErrors?: Record<string, string> };

export class ProjectInputValidationError extends Error {
  constructor(message: string, readonly workSampleErrors?: Record<string, string>) {
    super(message);
    this.name = "ProjectInputValidationError";
  }
}

export function isSafeMediaUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; }
}

function isBlankWorkSample(sample: WorkSample) {
  return !sample.mediaUrl && !sample.title && !sample.description && !sample.serviceCategory && !sample.locationNote && !sample.cloudinaryPublicId;
}

function logInvalidWorkSamples(samples: WorkSample[], errors: Record<string, string>) {
  if (process.env.NODE_ENV !== "production") {
    console.warn("Invalid work sample input", {
      samples: samples.map((sample) => ({
        id: sample.id,
        mediaType: sample.mediaType,
        hasTitle: Boolean(sample.title),
        hasMediaUrl: Boolean(sample.mediaUrl),
        mediaUrlIsHttp: isSafeMediaUrl(sample.mediaUrl),
        hasCloudinaryPublicId: Boolean(sample.cloudinaryPublicId),
      })),
      errors,
    });
  }
}

export function validateProjectInput(input: WebsiteProjectInput): ProjectValidationResult {
  const { business } = input;
  const services = business.services.map((service) => ({ ...service, name: service.name.trim(), description: service.description.trim(), notes: service.notes.trim() })).filter((service) => service.name).slice(0, 12);
  const normalizedWorkSamples = input.workSamples.map((sample) => ({ ...sample, mediaUrl: sample.mediaUrl.trim(), title: sample.title.trim(), description: sample.description.trim(), serviceCategory: sample.serviceCategory.trim(), locationNote: sample.locationNote.trim() })).slice(0, 24);
  const workSamples = normalizedWorkSamples.filter((sample) => !isBlankWorkSample(sample));
  const testimonials = input.testimonials.map((testimonial) => ({ ...testimonial, customerName: testimonial.customerName.trim(), testimonialText: testimonial.testimonialText.trim(), serviceType: testimonial.serviceType.trim(), locationNote: testimonial.locationNote.trim(), rating: testimonial.rating.trim() })).slice(0, 24);
  if (!business.businessName.trim() || !business.category.trim() || !business.serviceArea.trim()) return { valid: false, message: "Business name, type, and service area are required." };
  if (business.description.trim().length < 20) return { valid: false, message: "Please provide a business description of at least 20 characters." };
  if (!business.phone.trim() || !/^\S+@\S+\.\S+$/.test(business.email)) return { valid: false, message: "Please provide a phone number and valid email address." };
  if (services.length === 0) return { valid: false, message: "Please add at least one service." };
  const workSampleErrors = Object.fromEntries(workSamples.flatMap((sample) => {
    if (!sample.title && sample.mediaUrl) return [[sample.id, "Add a title for this work sample."]];
    if (sample.title && !sample.mediaUrl) return [[sample.id, "Upload media or add a valid media URL."]];
    if (!sample.title && !sample.mediaUrl) return [[sample.id, "Add a title and upload media or add a valid media URL."]];
    if (!isSafeMediaUrl(sample.mediaUrl)) return [[sample.id, "Use a valid http or https media URL."]];
    return [];
  }));
  if (Object.keys(workSampleErrors).length > 0) {
    logInvalidWorkSamples(workSamples, workSampleErrors);
    return { valid: false, message: "Please complete or remove the highlighted work samples.", workSampleErrors };
  }
  if (testimonials.some((testimonial) => !testimonial.customerName || !testimonial.testimonialText || (testimonial.rating && (!/^\d+$/.test(testimonial.rating) || Number(testimonial.rating) < 1 || Number(testimonial.rating) > 5)))) return { valid: false, message: "Each testimonial needs a customer name and quote; ratings must be between 1 and 5." };
  if (!visualStyles.includes(input.visualStyle) || !brandTones.includes(business.tone) || !callToActions.includes(business.callToAction)) return { valid: false, message: "One or more selected options are invalid." };
  return { valid: true, services, workSamples, testimonials };
}
