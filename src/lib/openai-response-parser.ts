type ResponsesApiContent = { type?: unknown; text?: unknown };
type ResponsesApiOutput = { type?: unknown; content?: unknown };
export type ResponsesApiResponse = { output_text?: unknown; output?: unknown; status?: unknown; error?: unknown; incomplete_details?: unknown };

export function extractResponseText(response: ResponsesApiResponse): string | null {
  if (typeof response.output_text === "string" && response.output_text.trim()) return response.output_text;
  if (!Array.isArray(response.output)) return null;
  const text = response.output.flatMap((item: ResponsesApiOutput) => Array.isArray(item?.content) ? item.content : []).filter((item: ResponsesApiContent) => item?.type === "output_text" && typeof item.text === "string").map((item: ResponsesApiContent) => (item.text as string).trim()).filter(Boolean).join("\n");
  return text || null;
}

export function responseSummary(response: ResponsesApiResponse) {
  return { status: response.status, outputItemTypes: Array.isArray(response.output) ? response.output.map((item: ResponsesApiOutput) => typeof item?.type === "string" ? item.type : "unknown") : [], contentItemTypes: Array.isArray(response.output) ? response.output.flatMap((item: ResponsesApiOutput) => Array.isArray(item?.content) ? item.content.map((content: ResponsesApiContent) => typeof content?.type === "string" ? content.type : "unknown") : []) : [] };
}
