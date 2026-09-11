import type { StructuredWebsiteContent, WebsiteProject } from "@/lib/website-types";

const automotiveTerms = ["vehicle repair", "auto repair", "mechanic", "brakes"];

function projectFacts(project: WebsiteProject) {
  const { business } = project;
  return [business.businessName, business.category, business.description, business.serviceArea, business.businessStory, business.targetAudience, business.differentiators, business.customerPriorities, business.factualNotes, ...business.services.flatMap((service) => [service.name, service.description, service.notes]), ...project.workSamples.flatMap((sample) => [sample.title, sample.description, sample.serviceCategory, sample.locationNote]), ...project.testimonials.flatMap((testimonial) => [testimonial.testimonialText, testimonial.serviceType, testimonial.locationNote])].join(" ").toLowerCase();
}

function contentText(content: StructuredWebsiteContent) {
  return JSON.stringify(content).toLowerCase();
}

export function findCrossIndustryTerms(project: WebsiteProject, content: StructuredWebsiteContent) {
  const facts = projectFacts(project);
  const output = contentText(content);
  return automotiveTerms.filter((term) => output.includes(term) && !facts.includes(term));
}

export function assertContentGroundedInProject(project: WebsiteProject, content: StructuredWebsiteContent) {
  const leakedTerms = findCrossIndustryTerms(project, content);
  if (leakedTerms.length > 0) throw new Error(`Generated content included unsupported industry terms: ${leakedTerms.join(", ")}`);
}
