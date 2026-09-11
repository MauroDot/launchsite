export const visualStyles = ["Modern", "Bold", "Professional", "Friendly", "Minimal"] as const;
export const brandTones = ["Warm and welcoming", "Confident and direct", "Polished and professional", "Down-to-earth and local"] as const;
export const callToActions = ["Request an estimate", "Book a consultation", "Call us today", "Get in touch"] as const;

export type VisualStyle = (typeof visualStyles)[number];
export type BrandTone = (typeof brandTones)[number];
export type PrimaryCallToAction = (typeof callToActions)[number];

export type BusinessService = { id: string; name: string; description: string; notes: string };
export type WorkSample = { id: string; mediaType: "IMAGE" | "VIDEO"; mediaUrl: string; title: string; description: string; serviceCategory: string; locationNote: string; cloudinaryPublicId?: string; width?: number; height?: number; duration?: number; format?: string; bytes?: number };
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
  siteSettings?: SiteSettings;
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

export const siteSectionIds = ["hero", "services", "about", "benefits", "work", "testimonials", "faq", "contact"] as const;
export type SiteSectionId = (typeof siteSectionIds)[number];
export const layoutFamilies = ["Classic", "Conversion", "Showcase"] as const;
export type LayoutFamily = (typeof layoutFamilies)[number];
export const layoutDefaultOrders: Record<LayoutFamily, SiteSectionId[]> = { Classic: ["hero", "services", "about", "benefits", "work", "testimonials", "faq", "contact"], Conversion: ["hero", "benefits", "services", "testimonials", "work", "about", "faq", "contact"], Showcase: ["hero", "work", "about", "services", "testimonials", "benefits", "faq", "contact"] };
export const palettePresets = { "Professional Blue": { primaryColor: "#1d4ed8", accentColor: "#dbeafe", backgroundColor: "#ffffff", textColor: "#0f172a", mutedTextColor: "#475569" }, "Contractor Red": { primaryColor: "#b91c1c", accentColor: "#fee2e2", backgroundColor: "#fffafa", textColor: "#18181b", mutedTextColor: "#52525b" }, "Fresh Green": { primaryColor: "#15803d", accentColor: "#dcfce7", backgroundColor: "#f7fdf8", textColor: "#052e16", mutedTextColor: "#3f6212" }, "Warm Earth": { primaryColor: "#92400e", accentColor: "#fef3c7", backgroundColor: "#fffbeb", textColor: "#451a03", mutedTextColor: "#78350f" }, "Modern Slate": { primaryColor: "#334155", accentColor: "#e2e8f0", backgroundColor: "#f8fafc", textColor: "#0f172a", mutedTextColor: "#475569" }, "Premium Dark": { primaryColor: "#111827", accentColor: "#e5e7eb", backgroundColor: "#111827", textColor: "#f9fafb", mutedTextColor: "#cbd5e1" }, "Bright Service": { primaryColor: "#0369a1", accentColor: "#cffafe", backgroundColor: "#f0f9ff", textColor: "#082f49", mutedTextColor: "#155e75" }, "Minimal Neutral": { primaryColor: "#44403c", accentColor: "#f5f5f4", backgroundColor: "#fafaf9", textColor: "#1c1917", mutedTextColor: "#57534e" } } as const;
export type ThemeSettings = { primaryColor: string; accentColor: string; backgroundColor: string; textColor: string; mutedTextColor: string; autoContrast: boolean; backgroundStyle: "Light" | "Soft" | "Dark"; fontPair: "Modern" | "Professional" | "Friendly" | "Bold" | "Classic" | "Minimal"; buttonStyle: "Rounded" | "Soft" | "Square"; spacingDensity: "Compact" | "Comfortable" | "Spacious"; heroStyle: "Text Focus" | "Split" | "Visual"; logoUrl?: string };
export const defaultThemeSettings: ThemeSettings = { primaryColor: "#1d4ed8", accentColor: "#dbeafe", backgroundColor: "#ffffff", textColor: "#0f172a", mutedTextColor: "#475569", autoContrast: true, backgroundStyle: "Light", fontPair: "Modern", buttonStyle: "Rounded", spacingDensity: "Comfortable", heroStyle: "Split" };
export type SiteSettings = { layoutFamily: LayoutFamily; hiddenSections: SiteSectionId[]; sectionOrder: SiteSectionId[]; theme: ThemeSettings };
export const defaultSiteSettings: SiteSettings = { layoutFamily: "Classic", hiddenSections: [], sectionOrder: layoutDefaultOrders.Classic, theme: defaultThemeSettings };

export type PersistedWebsiteProject = WebsiteProject & {
  id: string;
  slug: string;
  status: "DRAFT";
  createdAt: Date;
  updatedAt: Date;
  isDemo: boolean;
  featured: boolean;
  demoTitle?: string;
  demoDescription?: string;
  demoSortOrder?: number;
};

export type DemoSettings = { isDemo: boolean; featured: boolean; demoTitle: string; demoDescription: string; demoSortOrder: string };

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
