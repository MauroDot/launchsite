import "server-only";
import { BillingError } from "./errors";
import type { PaidPlan } from "./plans";

export function getPriceIds(): Record<PaidPlan, string> {
  const starter = process.env.STRIPE_STARTER_PRICE_ID?.trim();
  const business = process.env.STRIPE_BUSINESS_PRICE_ID?.trim();
  if (!starter?.startsWith("price_") || !business?.startsWith("price_") || starter === business) {
    throw new BillingError("BILLING_NOT_CONFIGURED", "Billing is not configured yet. Please contact LaunchSite support.");
  }
  return { STARTER: starter, BUSINESS: business };
}

export function getWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new BillingError("BILLING_NOT_CONFIGURED", "Stripe webhook configuration is missing.");
  return secret;
}
