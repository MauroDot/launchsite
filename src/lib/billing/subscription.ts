import "server-only";
import type Stripe from "stripe";
import type { PaidPlan, Plan } from "./plans";

/** Base plan is selected from trusted Price IDs, never subscription metadata.
 * Additional items can later represent add-ons without changing this contract. */
export function normalizeSubscription(subscription: Stripe.Subscription, priceIds: Record<PaidPlan, string>, featuredPriceId?: string) {
  const matches = subscription.items.data.filter((item) => Object.values(priceIds).includes(item.price.id));
  const featured = featuredPriceId ? subscription.items.data.find((item) => item.price.id === featuredPriceId && item.quantity === 1) : null;
  const item = matches.length === 1 && matches[0].quantity === 1 ? matches[0] : null;
  const plan: Plan = item ? (item.price.id === priceIds.BUSINESS ? "BUSINESS" : "STARTER") : "FREE";
  return {
    stripeSubscriptionId: subscription.id,
    stripePriceId: item?.price.id ?? null,
    plan, subscriptionStatus: subscription.status,
    subscriptionCreatedAt: new Date(subscription.created * 1000),
    currentPeriodStart: item && Number.isFinite(item.current_period_start) ? new Date(item.current_period_start * 1000) : null,
    currentPeriodEnd: item && Number.isFinite(item.current_period_end) ? new Date(item.current_period_end * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    featuredAddonActive: Boolean(featured && subscription.status !== "canceled" && ["active", "trialing", "past_due"].includes(subscription.status)),
    featuredAddonPriceId: featured?.price.id ?? null,
    featuredAddonCurrentPeriodEnd: featured && Number.isFinite(featured.current_period_end) ? new Date(featured.current_period_end * 1000) : null,
  };
}
