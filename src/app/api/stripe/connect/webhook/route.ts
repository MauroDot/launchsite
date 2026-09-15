import type Stripe from "stripe";
import { getMerchantStripe } from "@/lib/payments/stripe";
import { processConnectEvent, processConnectAccountEvent } from "@/lib/payments/webhooks";
import { logOperationalError } from "@/lib/operational-logging";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  // Stripe requires distinct destinations/secrets for thin and snapshot events.
  // A fixed URL query selects the destination, not unverified payload content.
  const accountEvents = new URL(request.url).searchParams.get("events") === "accounts";
  const secret = (accountEvents ? process.env.STRIPE_CONNECT_ACCOUNTS_WEBHOOK_SECRET : process.env.STRIPE_CONNECT_WEBHOOK_SECRET)?.trim();
  if (!secret || !process.env.STRIPE_SECRET_KEY?.trim()) return Response.json({ error: "Connect is not configured." }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature." }, { status: 400 });
  let event: Stripe.Event | Stripe.V2.Core.EventNotification;
  try {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (Number(request.headers.get("content-length")) > 1_000_000) return new Response(null, { status: 413 });
    if (reader) while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_000_000) { await reader.cancel(); return new Response(null, { status: 413 }); }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks);
    event = accountEvents ? getMerchantStripe().parseEventNotification(body, signature, secret) : getMerchantStripe().webhooks.constructEvent(body, signature, secret);
    if (accountEvents ? event.object !== "v2.core.event" : event.object !== "event") return Response.json({ error: "Wrong event destination." }, { status: 400 });
  } catch { return Response.json({ error: "Invalid signature." }, { status: 400 }); }
  try {
    if (accountEvents) await processConnectAccountEvent(event as Stripe.V2.Core.EventNotification);
    else await processConnectEvent(event as Stripe.Event);
    return Response.json({ received: true });
  }
  catch { logOperationalError({ category: "STRIPE", action: "merchant-webhook", eventId: event.id, eventType: event.type }); return Response.json({ error: "Payment synchronization failed. Retry delivery." }, { status: 500 }); }
}
