import { getStripe } from "@/lib/billing/stripe";
import { getWebhookSecret } from "@/lib/billing/config";
import { processStripeEvent } from "@/lib/billing/webhooks";
import { BillingError } from "@/lib/billing/errors";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const maxDuration = 60;

async function rawBody(request: Request) {
  if (Number(request.headers.get("content-length")) > 1_000_000) return null;
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1_000_000) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing webhook signature." }, { status: 400 });
  let event: Stripe.Event;
  try {
    const body = await rawBody(request);
    if (body === null) return Response.json({ error: "Webhook payload too large." }, { status: 413 });
    event = getStripe().webhooks.constructEvent(body, signature, getWebhookSecret());
  } catch (error) {
    return Response.json({ error: error instanceof BillingError ? "Billing is not configured." : "Invalid webhook signature." }, { status: error instanceof BillingError ? 503 : 400 });
  }
  try {
    await processStripeEvent(event);
    return Response.json({ received: true });
  } catch (error) {
    // Do not log bodies, customer payment data, API keys, or raw SDK errors.
    console.error("Stripe webhook processing failed", { eventId: event.id, eventType: event.type, errorType: error instanceof Error ? error.name : "Unknown" });
    return Response.json({ error: "Unable to synchronize billing. Please retry." }, { status: 500 });
  }
}
