import { defaultSiteSettings, defaultThemeSettings, type WebsiteProject, type SiteSettings } from "./website-types";

/** The renderer consumes website content, never a persisted project or account. */
export type PublicSite = {
  publicSlug?: string;
  business: Pick<WebsiteProject["business"], "businessName" | "category" | "description" | "phone" | "email" | "serviceArea" | "callToAction">;
  content: WebsiteProject["content"];
  generatedContent?: WebsiteProject["generatedContent"];
  siteSettings: SiteSettings;
  workSamples: Array<Pick<WebsiteProject["workSamples"][number], "id" | "mediaType" | "mediaUrl" | "title" | "description">>;
  testimonials: Array<Pick<WebsiteProject["testimonials"][number], "id" | "customerName" | "testimonialText">>;
};

export function toPublicSite(project: WebsiteProject & { publicSlug?: string }): PublicSite {
  const { business: b, content: c, generatedContent: g } = project;
  const settings = project.siteSettings ?? defaultSiteSettings;
  // JSON fields can contain unknown keys. Copy only documented website fields,
  // including nested objects, so debug data cannot cross this boundary.
  const services = (items: Array<{ name: string; description: string }>) => items.map(({ name, description }) => ({ name, description }));
  const theme = Object.fromEntries(Object.keys({ ...defaultThemeSettings, logoUrl: "" }).map((key) => [key, settings.theme[key as keyof typeof settings.theme]])) as SiteSettings["theme"];
  return {
    publicSlug: project.publicSlug,
    business: { businessName: b.businessName, category: b.category, description: b.description, phone: b.phone, email: b.email, serviceArea: b.serviceArea, callToAction: b.callToAction },
    content: { tagline: c.tagline, heroHeading: c.heroHeading, heroDescription: c.heroDescription, services: services(c.services), about: c.about, benefits: [...c.benefits], contactPrompt: c.contactPrompt },
    generatedContent: g ? {
      businessName: g.businessName, tagline: g.tagline,
      hero: { headline: g.hero.headline, supportingText: g.hero.supportingText, primaryCTA: g.hero.primaryCTA, secondaryCTA: g.hero.secondaryCTA },
      services: services(g.services), about: { heading: g.about.heading, body: g.about.body }, benefits: [...g.benefits],
      faq: g.faq.map(({ question, answer }) => ({ question, answer })),
      contact: { heading: g.contact.heading, body: g.contact.body }, seo: { title: g.seo.title, description: g.seo.description },
    } : undefined,
    siteSettings: { layoutFamily: settings.layoutFamily, hiddenSections: [...settings.hiddenSections], sectionOrder: [...settings.sectionOrder], theme },
    workSamples: project.workSamples.map((sample, index) => ({ id: `work-${index}`, mediaType: sample.mediaType, mediaUrl: sample.mediaUrl, title: sample.title, description: sample.description })),
    testimonials: project.testimonials.map((item, index) => ({ id: `testimonial-${index}`, customerName: item.customerName, testimonialText: item.testimonialText })),
  };
}
