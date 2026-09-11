import { brandTones, callToActions, visualStyles, type BusinessService, type WebsiteProjectInput } from "@/lib/website-types";

export type ProjectValidationResult = { valid: true; services: BusinessService[] } | { valid: false; message: string };

export function validateProjectInput(input: WebsiteProjectInput): ProjectValidationResult {
  const { business } = input;
  const services = business.services.map((service) => ({ ...service, name: service.name.trim(), description: service.description.trim(), notes: service.notes.trim() })).filter((service) => service.name).slice(0, 12);
  if (!business.businessName.trim() || !business.category.trim() || !business.serviceArea.trim()) return { valid: false, message: "Business name, type, and service area are required." };
  if (business.description.trim().length < 20) return { valid: false, message: "Please provide a business description of at least 20 characters." };
  if (!business.phone.trim() || !/^\S+@\S+\.\S+$/.test(business.email)) return { valid: false, message: "Please provide a phone number and valid email address." };
  if (services.length === 0) return { valid: false, message: "Please add at least one service." };
  if (!visualStyles.includes(input.visualStyle) || !brandTones.includes(business.tone) || !callToActions.includes(business.callToAction)) return { valid: false, message: "One or more selected options are invalid." };
  return { valid: true, services };
}
