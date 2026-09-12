import type { BusinessProfile, GeneratedSiteContent, StructuredWebsiteContent, WebsiteProject, WebsiteProjectInput } from "@/lib/website-types";

function yearsPhrase(years: string): string {
  const numericYears = Number.parseInt(years, 10);
  return Number.isFinite(numericYears) && numericYears > 0 ? `With ${numericYears} years of experience, ` : "";
}

function firstSentence(value: string) {
  return value.trim().split(/(?<=[.!?])\s+/)[0] || "";
}

export function generateSiteContent(business: BusinessProfile): GeneratedSiteContent {
  const serviceNames = business.services.map((service) => service.name.trim()).filter(Boolean).slice(0, 6);
  const category = business.category.trim();
  const serviceSummary = serviceNames.length > 0 ? serviceNames.join(", ") : `${category.toLowerCase()} services`;
  const businessContext = firstSentence(business.businessStory) || firstSentence(business.description);
  const differentiator = firstSentence(business.differentiators) || firstSentence(business.customerPriorities);
  const toneLead = business.tone === "Confident and direct" ? "Dependable" : business.tone === "Polished and professional" ? "Exceptional" : "Thoughtful";
  const aboutDetails = [businessContext, differentiator].filter(Boolean).join(" ");

  return {
    tagline: `${toneLead} ${category.toLowerCase()} in ${business.serviceArea}`,
    heroHeading: `${category} that puts your needs first.`,
    heroDescription: business.description,
    services: serviceNames.map((name) => {
      const service = business.services.find((item) => item.name.trim() === name);
      return { name, description: service?.description.trim() || `${name} for customers in ${business.serviceArea}.` };
    }),
    about: `${yearsPhrase(business.yearsInBusiness)}${business.businessName} serves ${business.serviceArea} with ${serviceSummary}. ${aboutDetails}`.trim(),
    benefits: [differentiator || "Clear communication from first call to final detail", business.customerPriorities.trim() || "Work shaped around your needs", `Serving ${business.serviceArea}`],
    contactPrompt: `Have a project in mind? Tell us what you need and ${business.businessName} will be glad to help.`,
  };
}

export function createWebsiteProject(input: WebsiteProjectInput): WebsiteProject {
  return { ...input, content: generateSiteContent(input.business) };
}

export function createEditableContentFromDeterministic(project: WebsiteProject): StructuredWebsiteContent {
  const { business, content } = project;
  return {
    businessName: business.businessName,
    tagline: content.tagline,
    hero: { headline: content.heroHeading, supportingText: content.heroDescription, primaryCTA: business.callToAction, secondaryCTA: business.secondaryCallToAction || null },
    services: content.services,
    about: { heading: `About ${business.businessName}`, body: content.about },
    benefits: content.benefits,
    faq: [
      { question: `What areas does ${business.businessName} serve?`, answer: `${business.businessName} serves ${business.serviceArea}.` },
      { question: "How can I get started?", answer: `Use the ${business.callToAction.toLowerCase()} option to tell us what you need.` },
    ],
    contact: { heading: "Let’s talk", body: content.contactPrompt },
    seo: { title: `${business.businessName} | ${business.category}`, description: business.description },
  };
}
