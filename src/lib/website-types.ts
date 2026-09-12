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
export const palettePresets = { "Professional Blue": { primaryColor: "#1d4ed8", accentColor: "#dbeafe", backgroundColor: "#ffffff", surfaceColor: "#eff6ff", cardColor: "#ffffff", textColor: "#0f172a", bodyTextColor: "#334155", mutedTextColor: "#475569" }, "Contractor Red": { primaryColor: "#b91c1c", accentColor: "#fee2e2", backgroundColor: "#fffafa", surfaceColor: "#fff1f2", cardColor: "#ffffff", textColor: "#18181b", bodyTextColor: "#3f3f46", mutedTextColor: "#52525b" }, "Fresh Green": { primaryColor: "#15803d", accentColor: "#dcfce7", backgroundColor: "#f7fdf8", surfaceColor: "#ecfdf5", cardColor: "#ffffff", textColor: "#052e16", bodyTextColor: "#14532d", mutedTextColor: "#3f6212" }, "Warm Earth": { primaryColor: "#92400e", accentColor: "#fef3c7", backgroundColor: "#fffbeb", surfaceColor: "#fef3c7", cardColor: "#ffffff", textColor: "#451a03", bodyTextColor: "#78350f", mutedTextColor: "#78350f" }, "Modern Slate": { primaryColor: "#334155", accentColor: "#e2e8f0", backgroundColor: "#f8fafc", surfaceColor: "#f1f5f9", cardColor: "#ffffff", textColor: "#0f172a", bodyTextColor: "#334155", mutedTextColor: "#475569" }, "Premium Dark": { primaryColor: "#111827", accentColor: "#e5e7eb", backgroundColor: "#111827", surfaceColor: "#1f2937", cardColor: "#374151", textColor: "#f9fafb", bodyTextColor: "#e5e7eb", mutedTextColor: "#cbd5e1" }, "Bright Service": { primaryColor: "#0369a1", accentColor: "#cffafe", backgroundColor: "#f0f9ff", surfaceColor: "#e0f2fe", cardColor: "#ffffff", textColor: "#082f49", bodyTextColor: "#164e63", mutedTextColor: "#155e75" }, "Minimal Neutral": { primaryColor: "#44403c", accentColor: "#f5f5f4", backgroundColor: "#fafaf9", surfaceColor: "#f5f5f4", cardColor: "#ffffff", textColor: "#1c1917", bodyTextColor: "#44403c", mutedTextColor: "#57534e" } } as const;
export type ThemeSettings = { primaryColor: string; accentColor: string; backgroundColor: string; surfaceColor: string; cardColor: string; textColor: string; bodyTextColor: string; mutedTextColor: string; autoContrast: boolean; backgroundStyle: "Light" | "Soft" | "Dark"; fontPair: "Modern" | "Professional" | "Friendly" | "Bold" | "Classic" | "Minimal"; buttonStyle: "Rounded" | "Soft" | "Square"; spacingDensity: "Compact" | "Comfortable" | "Spacious"; heroStyle: "Text Focus" | "Split" | "Visual"; logoUrl?: string };
export const defaultThemeSettings: ThemeSettings = { primaryColor: "#1d4ed8", accentColor: "#dbeafe", backgroundColor: "#ffffff", surfaceColor: "#eff6ff", cardColor: "#ffffff", textColor: "#0f172a", bodyTextColor: "#334155", mutedTextColor: "#475569", autoContrast: true, backgroundStyle: "Light", fontPair: "Modern", buttonStyle: "Rounded", spacingDensity: "Comfortable", heroStyle: "Split" };
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
  isPublished: boolean;
  publishedAt?: Date;
  lastPublishedAt?: Date;
  publicSlug?: string;
  seoTitle?: string;
  seoDescription?: string;
  socialImageUrl?: string;
  allowIndexing: boolean;
  customDomain?: string;
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
