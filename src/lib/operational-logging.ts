import "server-only";
export type OperationalCategory = "AUTH" | "DATABASE" | "STRIPE" | "RESEND" | "CLOUDINARY" | "OPENAI" | "DOMAIN" | "LEAD" | "ANALYTICS" | "ADMIN" | "APP";
const secretKey = /(secret|token|password|api.?key|authorization|cookie|database.?url|access.?token|refresh.?token)/i;
function redact(text: string) { return text.replace(/(?:postgres(?:ql)?|mysql):\/\/\S+/gi, "[REDACTED_URL]").replace(/https?:\/\/[^\s/]*@\S+/gi, "[REDACTED_URL]").replace(/(?:[sr]k_(?:live|test)_|whsec_|re_|Bearer\s+)\S+/gi, "[REDACTED_SECRET]").replace(/(["']?(?:[\w-]*(?:secret|token|password|credential|cookie)|api[_-]?key|authorization)["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi, "$1[REDACTED_SECRET]"); }
function errorDetails(error: unknown) {
  if (!error || typeof error !== "object") return { message: "Non-object error" };
  const value = error as Record<string, unknown>;
  // Never serialize Stripe raw responses, headers, request bodies, or stacks.
  return Object.fromEntries(["name", "type", "code", "message", "requestId"].flatMap((key) =>
    typeof value[key] === "string" ? [[key === "name" ? "errorType" : key, redact(value[key]).slice(0, 300)]] : []));
}
function sanitize(value: unknown): unknown { if (value instanceof Error) return { errorType: value.name, message: redact(value.message.slice(0, 300)) }; if (Array.isArray(value)) return value.slice(0, 20).map(sanitize); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !secretKey.test(key)).map(([key, item]) => [key, sanitize(item)])); if (typeof value === "string") return redact(value.length > 500 ? value.slice(0, 500) : value); return value; }
export function logOperationalError(input: { category: OperationalCategory; action: string; error?: unknown; [key: string]: unknown }) { const { category, action, error, ...context } = input; console.error("Operational error", { category, action, ...sanitize(context) as object, ...(error ? { error: errorDetails(error) } : {}) }); }
export function configStatus(value: string | undefined) { return value?.trim() ? "CONFIGURED" : "MISSING"; }
