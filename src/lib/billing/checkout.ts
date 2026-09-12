import "server-only";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import type { BillingAccount } from "@prisma/client";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getAppUrl } from "@/lib/app-url";
import { getStripe } from "./stripe";
import { getPriceIds } from "./config";
import { BillingError } from "./errors";
import { isPaidPlan, plans } from "./plans";
import { blocksNewSubscription } from "./policy";
import { withBillingLock } from "./lock";

async function portalUrl(customer: string) {
  const session = await getStripe().billingPortal.sessions.create({ customer, return_url: `${getAppUrl()}/account/billing` });
  return session.url;
}

export async function createBillingPortal() {
  const user = await requireUser();
  const account = await prisma.billingAccount.findUnique({ where: { userId: user.id } });
  if (!account?.stripeCustomerId) throw new BillingError("BILLING_CUSTOMER_REQUIRED", "Choose a plan before managing billing.");
  return portalUrl(account.stripeCustomerId);
}

async function ensureCustomer(account: BillingAccount) {
  if (account.stripeCustomerId) return account.stripeCustomerId;
  const stripe = getStripe();
  // Recover a prior successful Stripe create if its local write failed. Metadata,
  // not email, is the association. The stable key covers search indexing delays.
  const escaped = account.userId.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const matches = await stripe.customers.search({ query: `metadata['launchsiteUserId']:'${escaped}'`, limit: 2 });
  if (matches.data.length > 1) throw new BillingError("BILLING_UNAVAILABLE", "We need to check your billing account. Please contact LaunchSite support.");
  const customer = matches.data[0] ?? await stripe.customers.create({ metadata: { launchsiteUserId: account.userId } }, { idempotencyKey: `launchsite-customer-${account.id}` });
  await prisma.billingAccount.update({ where: { userId: account.userId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

const clearAttempt = { checkoutSessionId: null, checkoutAttemptId: null, checkoutPlan: null, checkoutPriceId: null, checkoutExpiresAt: null };

/** Only authenticated server identity and application plan names are accepted. */
export async function createCheckout(plan: unknown) {
  const user = await requireUser();
  if (!isPaidPlan(plan)) throw new BillingError("INVALID_PLAN", "Choose Starter or Business to continue.");
  return withBillingLock(user.id, async () => {
    const stripe = getStripe();
    const origin = getAppUrl();
    // These writes intentionally use the main client under the advisory lock,
    // rather than the lock transaction. Recovery IDs survive Stripe timeouts.
    let account = await prisma.billingAccount.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
    const customer = await ensureCustomer(account);
    if (account.stripeSubscriptionId && blocksNewSubscription(account.subscriptionStatus)) {
      if (account.subscriptionStatus === "incomplete" && account.checkoutSessionId) {
        const pending = await stripe.checkout.sessions.retrieve(account.checkoutSessionId);
        if (pending.status === "open" && pending.url) return pending.url;
      }
      return portalUrl(customer);
    }
    const priceIds = getPriceIds();
    // Close the webhook-delay window: a paid/unfinished Stripe subscription must
    // not be duplicated merely because its webhook hasn't reached LaunchSite.
    for await (const subscription of stripe.subscriptions.list({ customer, status: "all", limit: 100 })) {
      const base = subscription.id === account.stripeSubscriptionId || subscription.metadata.launchsiteBaseSubscription === "true" || isPaidPlan(subscription.metadata.launchsitePlan) || subscription.items.data.some((item) => Object.values(priceIds).includes(item.price.id));
      if (base && blocksNewSubscription(subscription.status)) return portalUrl(customer);
    }

    let previous: Stripe.Checkout.Session | null = null;
    if (account.checkoutSessionId) previous = await stripe.checkout.sessions.retrieve(account.checkoutSessionId);
    if (!previous && account.checkoutAttemptId) {
      // Recover sessions created before a network/DB interruption, including a
      // completed Checkout whose webhook is still being retried.
      for await (const session of stripe.checkout.sessions.list({ customer, limit: 100 })) {
        if (session.metadata?.launchsiteCheckoutAttempt === account.checkoutAttemptId) { previous = session; break; }
      }
    }
    if (previous?.status === "complete") {
      const previousSubscriptionId = typeof previous.subscription === "string" ? previous.subscription : previous.subscription?.id;
      if (!previousSubscriptionId || blocksNewSubscription((await stripe.subscriptions.retrieve(previousSubscriptionId)).status)) return portalUrl(customer);
      // A completed Checkout from a now-terminal subscription must not prevent
      // subscribing again after cancellation or incomplete expiration.
    }
    if (previous?.status === "open") {
      if (account.checkoutPlan === plan && previous.url) return previous.url;
      // Expiration is required before switching plans. If Checkout completes
      // concurrently, Stripe rejects expiration and we do not create a second one.
      await stripe.checkout.sessions.expire(previous.id);
    }
    if (previous || (account.checkoutExpiresAt && account.checkoutExpiresAt.getTime() <= Date.now())) {
      account = await prisma.billingAccount.update({ where: { userId: user.id }, data: clearAttempt });
    }
    if (account.checkoutAttemptId && account.checkoutPlan !== plan) throw new BillingError("BILLING_UNAVAILABLE", "A previous checkout is still being prepared. Please retry that plan before changing plans.");
    if (!account.checkoutAttemptId) {
      const price = await stripe.prices.retrieve(priceIds[plan]);
      if (!price.active || price.currency !== "usd" || price.unit_amount !== plans[plan].monthlyPrice * 100 || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1 || price.recurring.usage_type !== "licensed") {
        throw new BillingError("BILLING_NOT_CONFIGURED", "This plan's billing setup needs attention. Please contact LaunchSite support.");
      }
      account = await prisma.billingAccount.update({ where: { userId: user.id }, data: { checkoutAttemptId: randomUUID(), checkoutPlan: plan, checkoutPriceId: priceIds[plan], checkoutExpiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription", customer, client_reference_id: user.id,
      line_items: [{ price: account.checkoutPriceId!, quantity: 1 }],
      success_url: `${origin}/account/billing?checkout=success`, cancel_url: `${origin}/pricing?checkout=canceled`,
      expires_at: Math.floor(account.checkoutExpiresAt!.getTime() / 1000),
      metadata: { launchsiteUserId: user.id, launchsitePlan: plan, launchsiteCheckoutAttempt: account.checkoutAttemptId! },
      subscription_data: { metadata: { launchsiteUserId: user.id, launchsitePlan: plan, launchsiteBaseSubscription: "true" } },
    }, { idempotencyKey: `launchsite-checkout-${account.checkoutAttemptId}` });
    await prisma.billingAccount.update({ where: { userId: user.id }, data: { checkoutSessionId: session.id } });
    if (!session.url) throw new BillingError("BILLING_UNAVAILABLE", "Checkout is not available right now. Please try again.");
    return session.url;
  });
}
