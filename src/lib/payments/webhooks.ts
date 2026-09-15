import "server-only";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { issueReceipt, withPaymentLock } from "./core";
import { connectState, getMerchantStripe, retrieveMerchantAccount } from "./stripe";

const idOf = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id;
const SUPPORTED = new Set(["account.application.deauthorized", "checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired", "payment_intent.succeeded", "payment_intent.payment_failed", "charge.refunded", "refund.updated", "refund.created", "refund.failed"]);

export const ACCOUNT_EVENTS = new Set([
  "v2.core.account.created", "v2.core.account.updated", "v2.core.account.closed",
  "v2.core.account[configuration.merchant].updated",
  "v2.core.account[configuration.merchant].capability_status_updated",
  "v2.core.account[requirements].updated", "v2.core.account[defaults].updated",
]);

export async function processConnectAccountEvent(event: Stripe.V2.Core.EventNotification) {
  if (!ACCOUNT_EVENTS.has(event.type)) return;
  const related = "related_object" in event ? event.related_object : undefined;
  if (!related || related.type !== "v2.core.account" || !related.id.startsWith("acct_")) throw new Error("Invalid Connect account event reference");
  const settings = await prisma.projectPaymentSettings.findUnique({ where: { stripeConnectAccountId: related.id } });
  if (!settings) return;
  await withPaymentLock(settings.projectId, async (tx) => {
    if (await tx.connectWebhookEvent.findUnique({ where: { eventId: event.id } })) return;
    // Use only the signed ID, never a supplied resource URL. Re-read included
    // capabilities under the same lock as the write; notification order is not
    // authoritative. Carry the SDK's verified notification context forward.
    const account = await retrieveMerchantAccount(related.id, event.context);
    await tx.projectPaymentSettings.update({ where: { projectId: settings.projectId }, data: connectState(account) });
    await tx.connectWebhookEvent.create({ data: { eventId: event.id, accountId: related.id, eventType: event.type } });
  });
}

export async function processConnectEvent(event: Stripe.Event) {
  if (!event.account || !SUPPORTED.has(event.type)) return;
  const settings = await prisma.projectPaymentSettings.findUnique({ where: { stripeConnectAccountId: event.account } });
  if (!settings) return;
  const accountId = event.account;
  await withPaymentLock(settings.projectId, async (tx) => {
    if (await tx.connectWebhookEvent.findUnique({ where: { eventId: event.id } })) return;
    const stripe = getMerchantStripe();
    const options = { stripeAccount: accountId };
    if (event.type === "account.application.deauthorized") {
      await tx.projectPaymentSettings.update({ where: { projectId: settings.projectId }, data: { stripeConnectStatus: "DISABLED", stripeChargesEnabled: false, stripePayoutsEnabled: false } });
    } else {
      let intentId: string | undefined;
      let session: Stripe.Checkout.Session | undefined;
      if (event.type.startsWith("checkout.session.")) {
        session = await stripe.checkout.sessions.retrieve((event.data.object as Stripe.Checkout.Session).id, {}, options);
        if (session.mode !== "payment") return;
        intentId = idOf(session.payment_intent);
      } else if (event.type.startsWith("payment_intent.")) intentId = (event.data.object as Stripe.PaymentIntent).id;
      else {
        const object = event.data.object as Stripe.Charge | Stripe.Refund;
        intentId = idOf(object.payment_intent);
      }
      const intent = intentId ? await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] }, options) : undefined;
      const paymentId = intent?.metadata.launchsiteMerchantPaymentId || session?.metadata?.launchsiteMerchantPaymentId;
      if (!paymentId) return; // Other connected-business transactions are not ours.
      const payment = await tx.customerPayment.findFirst({ where: { id: paymentId, projectId: settings.projectId, stripeConnectAccountId: accountId, paymentSource: "STRIPE" } });
      if (!payment) throw new Error("Merchant payment snapshot missing");
      if (payment.stripePaymentIntentId && payment.stripePaymentIntentId !== intentId || session && payment.stripeCheckoutSessionId && payment.stripeCheckoutSessionId !== session.id) throw new Error("Merchant payment association mismatch");
      if (intent && (intent.amount !== payment.totalAmount || intent.currency !== "usd") || session && (session.amount_total !== payment.totalAmount || session.currency !== "usd")) throw new Error("Merchant amount mismatch");
      const charge = intent?.latest_charge && typeof intent.latest_charge !== "string" ? intent.latest_charge : undefined;
      let status = payment.paymentStatus;
      if (intent?.status === "succeeded") {
        if (intent.amount_received !== payment.totalAmount || !charge?.paid || charge.amount !== payment.totalAmount || charge.currency !== "usd") throw new Error("Merchant settlement mismatch");
        status = charge.amount_refunded >= payment.totalAmount ? "REFUNDED" : charge.amount_refunded > 0 ? "PARTIALLY_REFUNDED" : "PAID";
      } else if (!payment.paidAt) {
        status = intent?.status === "canceled" || session?.status === "expired" ? "VOIDED" : intent?.status === "requires_payment_method" && intent.last_payment_error ? "FAILED" : "PENDING";
      }
      const details = session?.customer_details || charge?.billing_details;
      const stripeReceiptUrl = charge?.receipt_url && /^https:\/\/pay\.stripe\.com\//.test(charge.receipt_url) ? charge.receipt_url : null;
      await tx.customerPayment.update({ where: { id: payment.id }, data: {
        paymentStatus: status, ...(intentId ? { stripePaymentIntentId: intentId } : {}), ...(session ? { stripeCheckoutSessionId: session.id } : {}),
        ...(charge ? { stripeChargeId: charge.id, refundedAmount: charge.amount_refunded, stripeReceiptUrl } : {}),
        ...(intent?.status === "succeeded" ? { paidAt: payment.paidAt ?? new Date((charge?.created ?? event.created) * 1000) } : {}),
        ...(details?.name ? { customerName: details.name.slice(0, 150) } : {}), ...(details?.email ? { customerEmail: details.email.slice(0, 254) } : {}), ...(details?.phone ? { customerPhone: details.phone.slice(0, 40) } : {}),
      } });
      await issueReceipt(tx, payment.id, settings.projectId);
    }
    // The receipt, state, and event marker commit or roll back together.
    await tx.connectWebhookEvent.create({ data: { eventId: event.id, accountId, eventType: event.type } });
  });
}
