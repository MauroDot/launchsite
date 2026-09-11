import type { BusinessProfile, GeneratedSiteContent, WebsiteProject, WebsiteProjectInput } from "@/lib/website-types";

function yearsPhrase(years: string): string {
  const numericYears = Number.parseInt(years, 10);
  return Number.isFinite(numericYears) && numericYears > 0 ? `With ${numericYears} years of experience, ` : "";
}

export function generateSiteContent(business: BusinessProfile): GeneratedSiteContent {
  const serviceNames = business.services.map((service) => service.name.trim()).filter(Boolean).slice(0, 6);
  const isAutomotive = /auto|automotive|mechanic|vehicle|car/i.test(business.category);
  const workSummary = isAutomotive ? "vehicle repair and maintenance" : `${business.category.toLowerCase()} work`;
  const toneLead = business.tone === "Confident and direct" ? "Dependable" : business.tone === "Polished and professional" ? "Exceptional" : "Thoughtful";

  return {
    tagline: `${toneLead} ${business.category.toLowerCase()} in ${business.serviceArea}`,
    heroHeading: `${business.category} that puts your needs first.`,
    heroDescription: business.description,
    services: serviceNames.map((name) => ({ name, description: `Practical, reliable ${name.toLowerCase()} tailored to your needs.` })),
    about: `${yearsPhrase(business.yearsInBusiness)}${business.businessName} is proud to serve ${business.serviceArea}. We bring care, clear communication, and a thoughtful approach to ${workSummary}.`,
    benefits: ["Clear communication from first call to final detail", "Quality work built around your needs", `Proudly serving ${business.serviceArea}`],
    contactPrompt: `Have a project in mind? Tell us what you need and we’ll be glad to help.`,
  };
}

export function createWebsiteProject(input: WebsiteProjectInput): WebsiteProject {
  return { ...input, content: generateSiteContent(input.business) };
}
