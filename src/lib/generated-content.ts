import type { StructuredWebsiteContent } from "@/lib/website-types";

const isText = (value: unknown, min = 1) => typeof value === "string" && value.trim().length >= min;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export const generatedContentJsonSchema = {
  type: "object", additionalProperties: false, required: ["businessName", "tagline", "hero", "services", "about", "benefits", "faq", "contact", "seo"],
  properties: {
    businessName: { type: "string" }, tagline: { type: "string" },
    hero: { type: "object", additionalProperties: false, required: ["headline", "supportingText", "primaryCTA", "secondaryCTA"], properties: { headline: { type: "string" }, supportingText: { type: "string" }, primaryCTA: { type: "string" }, secondaryCTA: { anyOf: [{ type: "string" }, { type: "null" }] } } },
    services: { type: "array", minItems: 1, items: { type: "object", additionalProperties: false, required: ["name", "description"], properties: { name: { type: "string" }, description: { type: "string" } } } },
    about: { type: "object", additionalProperties: false, required: ["heading", "body"], properties: { heading: { type: "string" }, body: { type: "string" } } },
    benefits: { type: "array", minItems: 3, items: { type: "string" } }, faq: { type: "array", minItems: 2, items: { type: "object", additionalProperties: false, required: ["question", "answer"], properties: { question: { type: "string" }, answer: { type: "string" } } } },
    contact: { type: "object", additionalProperties: false, required: ["heading", "body"], properties: { heading: { type: "string" }, body: { type: "string" } } },
    seo: { type: "object", additionalProperties: false, required: ["title", "description"], properties: { title: { type: "string" }, description: { type: "string" } } },
  },
} as const;

export function validateGeneratedContent(value: unknown): StructuredWebsiteContent | null {
  if (!isRecord(value) || !isText(value.businessName) || !isText(value.tagline) || !isRecord(value.hero) || !isText(value.hero.headline) || !isText(value.hero.supportingText) || !isText(value.hero.primaryCTA) || (value.hero.secondaryCTA !== null && !isText(value.hero.secondaryCTA)) || !Array.isArray(value.services) || value.services.length === 0 || !value.services.every((item) => isRecord(item) && isText(item.name) && isText(item.description)) || !isRecord(value.about) || !isText(value.about.heading) || !isText(value.about.body) || !Array.isArray(value.benefits) || value.benefits.length < 3 || !value.benefits.every((item) => isText(item)) || !Array.isArray(value.faq) || value.faq.length < 2 || !value.faq.every((item) => isRecord(item) && isText(item.question) && isText(item.answer)) || !isRecord(value.contact) || !isText(value.contact.heading) || !isText(value.contact.body) || !isRecord(value.seo) || !isText(value.seo.title) || !isText(value.seo.description)) return null;
  return value as StructuredWebsiteContent;
}
