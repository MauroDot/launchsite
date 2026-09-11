import { generatedContentJsonSchema, validateGeneratedContent } from "@/lib/generated-content";
import { assertContentGroundedInProject } from "@/lib/content-grounding";
import { extractResponseText, responseSummary, type ResponsesApiResponse } from "@/lib/openai-response-parser";
import type { PersistedWebsiteProject, StructuredWebsiteContent } from "@/lib/website-types";

const model = "gpt-5";


export async function generateWebsiteContent(project: PersistedWebsiteProject): Promise<StructuredWebsiteContent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const business = project.business;
  const serviceFacts = business.services.map((service) => `${service.name}: ${service.description}${service.notes ? ` (${service.notes})` : ""}`).join("; ");
  const workSampleFacts = project.workSamples.map((sample) => `${sample.title}: ${sample.description || "no description"}${sample.serviceCategory ? `; service: ${sample.serviceCategory}` : ""}${sample.locationNote ? `; note: ${sample.locationNote}` : ""}`).join(" | ");
  const testimonialFacts = project.testimonials.map((testimonial) => `${testimonial.customerName}: ${testimonial.testimonialText}${testimonial.rating ? `; supplied rating: ${testimonial.rating}` : ""}`).join(" | ");
  const automotiveGuidance = /auto|automotive|mechanic|vehicle|car/i.test(`${business.category} ${business.description} ${serviceFacts}`) ? "For this automotive business only, broad automotive wording is allowed when it is supported by the current project facts." : "Do not use automotive terms or examples unless they appear in the current project facts.";
  const prompt = `Create polished, accurate marketing copy as JSON for this small business. Use only the CURRENT PROJECT FACTS below. Do not reuse wording, industries, services, locations, customers, or claims from any other business. Every industry-specific statement in hero, about, services, benefits, FAQ, contact, and SEO must be supported by these facts. Never claim licenses, certifications, awards, ratings, guarantees, customer counts, emergency availability, prices, or service areas beyond those supplied. Do not write HTML, CSS, JavaScript, markdown, or code. The About section must describe the company broadly: its overall type of work, experience when supplied, service philosophy, and the business as a whole. Do not center the About section on a single listed service or insert a raw service-list item into generic phrasing such as "every X project." Do not use list punctuation, bullets, leading hyphens, or comma-separated service lists in prose. Reserve individual service names primarily for the Services section unless they naturally belong in a sentence. ${automotiveGuidance} Work samples and testimonials are factual supplied content: do not invent, alter, or add quotes, work samples, or ratings. You may create only general introductory wording around them. CURRENT PROJECT FACTS — Business name: ${business.businessName}. Type: ${business.category}. Description: ${business.description}. Service area: ${business.serviceArea}. Services: ${serviceFacts}. Work samples: ${workSampleFacts || "none supplied"}. Testimonials: ${testimonialFacts || "none supplied"}. Business story: ${business.businessStory || "not supplied"}. Ideal customers: ${business.targetAudience || "not supplied"}. Differentiators: ${business.differentiators || "not supplied"}. Customer priorities: ${business.customerPriorities || "not supplied"}. Additional factual notes: ${business.factualNotes || "not supplied"}. Years in business: ${business.yearsInBusiness || "not supplied"}. Brand tone: ${business.tone}. Primary CTA: ${business.callToAction}. Secondary CTA: ${business.secondaryCallToAction || "not supplied"}. Visual style: ${project.visualStyle}.`;
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, store: false, input: prompt, text: { format: { type: "json_schema", name: "launchsite_content", strict: true, schema: generatedContentJsonSchema } } }) });
  if (!response.ok) {
    const body = await response.text();
    let details: unknown = body.slice(0, 4_000);
    try { details = JSON.parse(body); } catch { /* Keep the bounded text body for server diagnostics. */ }
    console.error("OpenAI Responses API request failed", { status: response.status, statusText: response.statusText, details });
    throw new Error("OpenAI content generation request failed.");
  }
  const result = await response.json() as ResponsesApiResponse;
  if (result.status === "failed" || result.status === "incomplete" || result.status === "cancelled") console.error("OpenAI Responses API returned an unfinished response", { ...responseSummary(result), error: result.error, incompleteDetails: result.incomplete_details });
  const responseText = extractResponseText(result);
  if (!responseText) {
    console.error("OpenAI Responses API returned no structured text", responseSummary(result));
    throw new Error("OpenAI returned no structured content.");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(responseText); } catch { throw new Error("OpenAI returned invalid JSON."); }
  const content = validateGeneratedContent(parsed);
  if (!content) throw new Error("OpenAI content did not match the required schema.");
  assertContentGroundedInProject(project, content);
  return content;
}
