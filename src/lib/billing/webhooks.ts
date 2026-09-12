import "server-only";
import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripe } from "./stripe";
import { getPriceIds } from "./config";
import { withBillingLock } from "./lock";
import { normalizeSubscription } from "./subscription";
import { blocksNewSubscription } from "./policy";
import { isPaidPlan } from "./plans";

const idOf = (value: string | { id: string } | null) => typeof value === "string" ? value : value?.id;

async function userForCustomer(customerId: string) {
  const account = await prisma.billingAccount.findUnique({ where: { stripeCustomerId: customerId } });
  if (account) return account.userId;
  const customer = await getStripe().customers.retrieve(customerId);
  if (customer.deleted || !customer.metadata.launchsiteUserId) return null;
  const userId = customer.metadata.launchsiteUserId;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return null;
  return user.id;
}

export async function syncStripeSubscription(tx: Prisma.TransactionClient, userId: string, subscription: Stripe.Subscription) {
  const customerId = idOf(subscription.customer)!;
  const account = await tx.billingAccount.findUnique({ where: { userId } });
  if (account?.stripeCustomerId && account.stripeCustomerId !== customerId) throw new Error("Billing customer association mismatch");
  const normalized = normalizeSubscription(subscription, getPriceIds());
  if (normalized.plan === "FREE" && account?.stripeSubscriptionId !== subscription.id && subscription.metadata.launchsiteBaseSubscription !== "true" && !isPaidPlan(subscription.metadata.launchsitePlan)) {
    console.warn("Ignoring unrecognized non-base subscription", { subscriptionId: subscription.id });
    return;
  }
  if (account?.stripeSubscriptionId && account.stripeSubscriptionId !== subscription.id) {
    // A delayed cancellation from a previous subscription must not revoke the
    // newer base subscription. Unrelated future add-ons cannot replace it.
    if (!blocksNewSubscription(subscription.status) || normalized.plan === "FREE" && subscription.metadata.launchsiteBaseSubscription !== "true" && !isPaidPlan(subscription.metadata.launchsitePlan)) return;
    if (account.subscriptionCreatedAt && normalized.subscriptionCreatedAt < account.subscriptionCreatedAt) return;
    const current = await getStripe().subscriptions.retrieve(account.stripeSubscriptionId);
    if (blocksNewSubscription(current.status)) {
      console.warn("Additional base subscription requires billing review", { subscriptionId: subscription.id });
      return;
    }
  }
  if (normalized.plan === "FREE") console.warn("Stripe subscription has no unique configured base price", { subscriptionId: subscription.id });
  await tx.billingAccount.upsert({
    where: { userId },
    create: { userId, stripeCustomerId: customerId, ...normalized },
    update: { stripeCustomerId: customerId, ...normalized },
  });
}

export async function processStripeEvent(event: Stripe.Event) {
  if (await prisma.stripeWebhookEvent.findUnique({ where: { eventId: event.id } })) return;
  let subscriptionId: string | undefined;
  let customerId: string | undefined;
  let deleted: Stripe.Subscription | undefined;
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") return;
      subscriptionId = idOf(session.subscription);
      customerId = idOf(session.customer);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      subscriptionId = subscription.id;
      customerId = idOf(subscription.customer);
      if (event.type === "customer.subscription.deleted") deleted = subscription;
      break;
    }
    default: return;
  }
  if (!customerId || !subscriptionId) throw new Error("Missing Stripe customer or subscription reference");
  const userId = await userForCustomer(customerId);
  if (!userId) { console.warn("Ignoring Stripe event for an unlinked customer", { eventId: event.id }); return; }
  await withBillingLock(userId, async (tx) => {
    if (await tx.stripeWebhookEvent.findUnique({ where: { eventId: event.id } })) return;
    // Fetch inside the same per-user lock as the write. Arrival order and event
    // timestamps are not reliable: even an old event reconciles current Stripe state.
    let subscription: Stripe.Subscription;
    try { subscription = await getStripe().subscriptions.retrieve(subscriptionId!); }
    catch (error) {
      if (deleted && error && typeof error === "object" && "code" in error && error.code === "resource_missing") subscription = { ...deleted, status: "canceled" };
      else throw error;
    }
    if (idOf(subscription.customer) !== customerId) throw new Error("Stripe event customer mismatch");
    if (subscription.items.has_more) {
      const items: Stripe.SubscriptionItem[] = [];
      for await (const item of getStripe().subscriptionItems.list({ subscription: subscription.id, limit: 100 })) items.push(item);
      subscription = { ...subscription, items: { ...subscription.items, data: items, has_more: false } };
    }
    await syncStripeSubscription(tx, userId, subscription);
    // Record success in the same transaction as the billing state. Failures
    // roll back both, allowing Stripe retries to complete the operation.
    await tx.stripeWebhookEvent.create({ data: { eventId: event.id, eventType: event.type } });
  });
}
