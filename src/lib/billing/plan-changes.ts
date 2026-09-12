import "server-only";
import type Stripe from "stripe";
import { requireUser } from "@/lib/access";
import { getPriceIds } from "./config";
import { BillingError } from "./errors";
import { getStripe } from "./stripe";
import { withBillingLock } from "./lock";
import { isPaidPlan, type PaidPlan } from "./plans";

function baseItem(subscription: Stripe.Subscription, prices: Record<PaidPlan, string>) {
  const matches = subscription.items.data.filter((item) => Object.values(prices).includes(item.price.id));
  if (matches.length !== 1 || matches[0].quantity !== 1) throw new BillingError("BILLING_UNAVAILABLE", "We could not identify the subscription plan. Please contact LaunchSite support.");
  return matches[0];
}

function currentPlan(priceId: string, prices: Record<PaidPlan, string>): PaidPlan {
  if (priceId === prices.STARTER) return "STARTER";
  if (priceId === prices.BUSINESS) return "BUSINESS";
  throw new BillingError("BILLING_UNAVAILABLE", "This subscription uses an unrecognized LaunchSite price.");
}

export async function changeSubscriptionPlan(target: unknown) {
  const user = await requireUser();
  if (!isPaidPlan(target)) throw new BillingError("INVALID_PLAN", "Choose Starter or Business.");
  return withBillingLock(user.id, async (tx) => {
    const account = await tx.billingAccount.findUnique({ where: { userId: user.id } });
    if (!account?.stripeCustomerId || !account.stripeSubscriptionId) throw new BillingError("BILLING_CUSTOMER_REQUIRED", "Choose a plan before changing your subscription.");
    const prices = getPriceIds();
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(account.stripeSubscriptionId);
    if (subscription.customer !== account.stripeCustomerId && typeof subscription.customer === "object" && subscription.customer.id !== account.stripeCustomerId) throw new BillingError("BILLING_UNAVAILABLE", "The Stripe customer does not match this account.");
    const item = baseItem(subscription, prices);
    const current = currentPlan(item.price.id, prices);
    if (current === target) return { kind: "current" as const, plan: current };
    if (account.pendingPlan) throw new BillingError("BILLING_UNAVAILABLE", "A plan change is already scheduled. Cancel it before choosing another plan.");

    if (current === "STARTER" && target === "BUSINESS") {
      await stripe.subscriptionItems.update(item.id, { price: prices.BUSINESS, quantity: 1, proration_behavior: "always_invoice", payment_behavior: "pending_if_incomplete" });
      return { kind: "upgrade-pending" as const, plan: target };
    }

    const effectiveAt = item.current_period_end;
    if (!Number.isFinite(effectiveAt) || effectiveAt <= Math.floor(Date.now() / 1000)) throw new BillingError("BILLING_UNAVAILABLE", "The current billing period could not be determined. Please try again.");
    const schedule = await stripe.subscriptionSchedules.create({ from_subscription: subscription.id });
    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      phases: [
        { items: [{ price: prices.BUSINESS, quantity: 1 }], start_date: schedule.phases[0]?.start_date ?? subscription.start_date, end_date: effectiveAt },
        { items: [{ price: prices.STARTER, quantity: 1 }], start_date: effectiveAt },
      ],
    });
    await tx.billingAccount.update({ where: { userId: user.id }, data: { pendingPlan: "STARTER", pendingPlanEffectiveAt: new Date(effectiveAt * 1000), stripeSubscriptionScheduleId: schedule.id } });
    return { kind: "downgrade-scheduled" as const, plan: current, effectiveAt: new Date(effectiveAt * 1000) };
  });
}

export async function cancelScheduledPlanChange() {
  const user = await requireUser();
  return withBillingLock(user.id, async (tx) => {
    const account = await tx.billingAccount.findUnique({ where: { userId: user.id } });
    if (!account?.stripeSubscriptionScheduleId) throw new BillingError("BILLING_UNAVAILABLE", "No scheduled plan change was found.");
    await getStripe().subscriptionSchedules.release(account.stripeSubscriptionScheduleId);
    await tx.billingAccount.update({ where: { userId: user.id }, data: { pendingPlan: null, pendingPlanEffectiveAt: null, stripeSubscriptionScheduleId: null } });
    return { kind: "canceled" as const };
  });
}
