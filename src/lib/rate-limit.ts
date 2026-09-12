type Entry = { count: number; resetAt: number };
const buckets = new Map<string, Entry>();
const MAX_BUCKETS = 10_000;

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > MAX_BUCKETS) for (const [name, entry] of buckets) if (entry.resetAt <= now) buckets.delete(name);
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return { ok: true, remaining: limit - 1, retryAfter: 0 }; }
  current.count += 1;
  return { ok: current.count <= limit, remaining: Math.max(0, limit - current.count), retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}

export function requestKey(request: Request, category: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  return `${category}:${address}`;
}

export function tooManyResponse(retryAfter: number) { return new Response(JSON.stringify({ ok: false, error: "Too many requests. Please try again shortly." }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter), "Cache-Control": "no-store" } }); }
