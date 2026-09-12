import { plans, isPaidPlan, type Plan } from "./plans";

export type BillingState = {
  plan: Plan;
  subscriptionStatus: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

// past_due retains access while Stripe retries. unpaid/paused/incomplete do not.
export function grantsPaidAccess(status: string | null) {
  return status === "active" || status === "trialing" || status === "past_due";
}

// An incomplete, paused, or unpaid subscription still needs to be resolved in
// the portal. Only terminal states permit another independent base subscription.
export function blocksNewSubscription(status: string | null) {
  return status !== null && status !== "canceled" && status !== "incomplete_expired";
}

export function entitlementsFromBilling(account: BillingState | null) {
  const hasActiveSubscription = Boolean(account?.stripeSubscriptionId && isPaidPlan(account.plan) && grantsPaidAccess(account.subscriptionStatus));
  const plan: Plan = hasActiveSubscription && account ? account.plan : "FREE";
  return {
    plan, subscriptionStatus: account?.subscriptionStatus ?? null, hasActiveSubscription,
    canPublish: hasActiveSubscription, maxPublishedSites: plans[plan].maxPublishedSites,
    canUseCustomDomain: hasActiveSubscription && plan === "BUSINESS",
    currentPeriodEnd: account?.currentPeriodEnd ?? null, cancelAtPeriodEnd: account?.cancelAtPeriodEnd ?? false,
  };
}
