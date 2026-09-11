export const visualStyles = ["Modern", "Bold", "Professional", "Friendly", "Minimal"] as const;
export const brandTones = ["Warm and welcoming", "Confident and direct", "Polished and professional", "Down-to-earth and local"] as const;
export const callToActions = ["Request an estimate", "Book a consultation", "Call us today", "Get in touch"] as const;

export type VisualStyle = (typeof visualStyles)[number];
export type BrandTone = (typeof brandTones)[number];
export type PrimaryCallToAction = (typeof callToActions)[number];

export type BusinessProfile = {
  businessName: string;
  category: string;
  description: string;
  serviceArea: string;
  phone: string;
  email: string;
  services: string;
  yearsInBusiness: string;
  tone: BrandTone;
  callToAction: PrimaryCallToAction;
};

export type WebsiteProjectInput = {
  business: BusinessProfile;
  visualStyle: VisualStyle;
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
  services: "",
  yearsInBusiness: "",
  tone: "Warm and welcoming",
  callToAction: "Request an estimate",
};
