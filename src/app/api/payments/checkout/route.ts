import { createMerchantCheckout } from "@/lib/payments/service";
import { limitPayments } from "@/lib/payments/core";
import { PaymentError, text } from "@/lib/payments/validation";
import { requestKey } from "@/lib/rate-limit";
import { logOperationalError } from "@/lib/operational-logging";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    await limitPayments(requestKey(request, "merchant-checkout"), 15);
    if (!request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) return new Response("Invalid form.", { status: 400 });
    // Stream with a strict bound; do not buffer an unbounded public request.
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    if (reader) while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 4096) { await reader.cancel(); return new Response("Form too large.", { status: 413 }); } chunks.push(value); }
    const form = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
    const url = await createMerchantCheckout(text(form.get("slug"), "site", 100), text(form.get("itemId"), "offer", 100), { amount: form.get("amount"), requestId: form.get("requestId") }, request.headers.get("origin"));
    return Response.redirect(url, 303);
  } catch (error) {
    if (!(error instanceof PaymentError)) logOperationalError({ category: "STRIPE", action: "merchant-checkout" });
    return new Response(error instanceof PaymentError ? `${error.message} Return to the business website and try again.` : "Checkout is temporarily unavailable. Return to the business website and try again.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
}
