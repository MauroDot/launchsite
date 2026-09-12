import "server-only";
import Stripe from "stripe";
import { BillingError } from "./errors";

let client: Stripe | undefined;
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new BillingError("BILLING_NOT_CONFIGURED", "Billing is not configured yet. Please contact LaunchSite support.");
  // Lazy initialization lets the rest of LaunchSite run without Stripe keys.
  return client ??= new Stripe(key, { maxNetworkRetries: 1, timeout: 5000 });
}
