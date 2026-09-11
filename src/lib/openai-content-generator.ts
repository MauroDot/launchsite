import { generatedContentJsonSchema, validateGeneratedContent } from "@/lib/generated-content";
import type { PersistedWebsiteProject, StructuredWebsiteContent } from "@/lib/website-types";

export async function generateWebsiteContent(project: PersistedWebsiteProject): Promise<StructuredWebsiteContent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const business = project.business;
  const serviceFacts = business.services.map((service) => `${service.name}: ${service.description}${service.notes ? ` (${service.notes})` : ""}`).join("; ");
  const prompt = `Create polished, accurate marketing copy as JSON for this small business. Use only supplied facts. Never claim licenses, certifications, awards, ratings, guarantees, customer counts, emergency availability, prices, or service areas beyond those supplied. Do not write HTML, CSS, JavaScript, markdown, or code. The About section must describe the company broadly: its overall type of work, experience when supplied, service philosophy, and the business as a whole. Do not center the About section on a single listed service or insert a raw service-list item into generic phrasing such as "every X project." Do not use list punctuation, bullets, leading hyphens, or comma-separated service lists in prose. Reserve individual service names primarily for the Services section unless they naturally belong in a sentence. For automotive businesses, summarize broadly with wording such as "auto repair," "vehicle repair and maintenance," or "mobile automotive service" when supported by the supplied facts. Business name: ${business.businessName}. Type: ${business.category}. Description: ${business.description}. Service area: ${business.serviceArea}. Services: ${serviceFacts}. Business story: ${business.businessStory || "not supplied"}. Ideal customers: ${business.targetAudience || "not supplied"}. Differentiators: ${business.differentiators || "not supplied"}. Customer priorities: ${business.customerPriorities || "not supplied"}. Additional factual notes: ${business.factualNotes || "not supplied"}. Years in business: ${business.yearsInBusiness || "not supplied"}. Brand tone: ${business.tone}. Primary CTA: ${business.callToAction}. Secondary CTA: ${business.secondaryCallToAction || "not supplied"}. Visual style: ${project.visualStyle}.`;
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-5", store: false, input: prompt, text: { format: { type: "json_schema", name: "launchsite_content", strict: true, schema: generatedContentJsonSchema } } }) });
  if (!response.ok) throw new Error(`OpenAI request failed with status ${response.status}.`);
  const result = await response.json() as { output_text?: string };
  if (!result.output_text) throw new Error("OpenAI returned no structured content.");
  let parsed: unknown;
  try { parsed = JSON.parse(result.output_text); } catch { throw new Error("OpenAI returned invalid JSON."); }
  const content = validateGeneratedContent(parsed);
  if (!content) throw new Error("OpenAI content did not match the required schema.");
  return content;
}
