export const visualStyles = ["Modern", "Bold", "Professional", "Friendly", "Minimal"] as const;
export const brandTones = ["Warm and welcoming", "Confident and direct", "Polished and professional", "Down-to-earth and local"] as const;
export const callToActions = ["Request an estimate", "Book a consultation", "Call us today", "Get in touch"] as const;

export type VisualStyle = (typeof visualStyles)[number];
export type BrandTone = (typeof brandTones)[number];
export type PrimaryCallToAction = (typeof callToActions)[number];

export type BusinessService = { id: string; name: string; description: string; notes: string };
export type WorkSample = { id: string; mediaType: "IMAGE" | "VIDEO"; mediaUrl: string; title: string; description: string; serviceCategory: string; locationNote: string };
export type Testimonial = { id: string; customerName: string; testimonialText: string; serviceType: string; locationNote: string; rating: string };

export type BusinessProfile = {
  businessName: string;
  category: string;
  description: string;
  businessStory: string;
  targetAudience: string;
  differentiators: string;
  customerPriorities: string;
  factualNotes: string;
  serviceArea: string;
  phone: string;
  email: string;
  services: BusinessService[];
  yearsInBusiness: string;
  tone: BrandTone;
  callToAction: PrimaryCallToAction;
  secondaryCallToAction: string;
};

export type WebsiteProjectInput = {
  business: BusinessProfile;
  visualStyle: VisualStyle;
  workSamples: WorkSample[];
  testimonials: Testimonial[];
};

export type GeneratedSiteContent = {
  tagline: string;
  heroHeading: string;
  heroDescription: string;
  services: Array<{ name: string; description: string }>;
  about: string;
  benefits: string[];
  contactPrompt: string;
};

export type WebsiteProject = WebsiteProjectInput & {
  content: GeneratedSiteContent;
  generatedContent?: StructuredWebsiteContent;
  contentGeneratedAt?: Date;
};

export type StructuredWebsiteContent = {
  businessName: string;
  tagline: string;
  hero: { headline: string; supportingText: string; primaryCTA: string; secondaryCTA?: string | null };
  services: Array<{ name: string; description: string }>;
  about: { heading: string; body: string };
  benefits: string[];
  faq: Array<{ question: string; answer: string }>;
  contact: { heading: string; body: string };
  seo: { title: string; description: string };
};

export type PersistedWebsiteProject = WebsiteProject & {
  id: string;
  slug: string;
  status: "DRAFT";
  createdAt: Date;
  updatedAt: Date;
};

export const initialBusinessProfile: BusinessProfile = {
  businessName: "",
  category: "",
  description: "",
  serviceArea: "",
  phone: "",
  email: "",
  businessStory: "",
  targetAudience: "",
  differentiators: "",
  customerPriorities: "",
  factualNotes: "",
  services: [],
  yearsInBusiness: "",
  tone: "Warm and welcoming",
  callToAction: "Request an estimate",
  secondaryCallToAction: "",
};
