import "server-only";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/access";
import { getUserEntitlements } from "./entitlements";
import { BillingError } from "./errors";
import { getFeaturedBusinessPriceId } from "./config";
import { getStripe } from "./stripe";

async function ownedSubscription(userId: string) {
  const account = await prisma.billingAccount.findUnique({ where: { userId } });
  if (!account?.stripeSubscriptionId || !account.stripeCustomerId) throw new BillingError("BILLING_CUSTOMER_REQUIRED", "Choose a paid plan before adding Featured Business.");
  const subscription = await getStripe().subscriptions.retrieve(account.stripeSubscriptionId);
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  if (customerId !== account.stripeCustomerId) throw new BillingError("BILLING_UNAVAILABLE", "Billing account verification failed.");
  return { account, subscription };
}

export async function addFeaturedBusinessAddon() {
  const user = await requireUser(); const entitlements = await getUserEntitlements(user.id);
  if (!entitlements.canPurchaseFeaturedBusiness) throw new BillingError("FEATURED_ADDON_NOT_ELIGIBLE", "Featured Business requires an active Starter or Business plan.");
  const price = getFeaturedBusinessPriceId(); const { subscription } = await ownedSubscription(user.id);
  if (!["active", "trialing", "past_due"].includes(subscription.status)) throw new BillingError("FEATURED_ADDON_NOT_ELIGIBLE", "Your base subscription is not currently eligible.");
  if (subscription.items.data.some((item) => item.price.id === price)) throw new BillingError("FEATURED_ADDON_ALREADY_ACTIVE", "Featured Business is already active.");
  await getStripe().subscriptionItems.create({ subscription: subscription.id, price, quantity: 1, proration_behavior: "always_invoice" });
  return { ok: true as const };
}

export async function cancelFeaturedBusinessAddon() {
  const user = await requireUser(); const entitlements = await getUserEntitlements(user.id);
  if (!entitlements.hasFeaturedBusinessAddon) throw new BillingError("FEATURED_ADDON_REQUIRED", "Featured Business is not active.");
  const price = getFeaturedBusinessPriceId(); const { account, subscription } = await ownedSubscription(user.id);
  const item = subscription.items.data.find((candidate) => candidate.price.id === price);
  if (!item) throw new BillingError("FEATURED_ADDON_REQUIRED", "Featured Business is not active on the current subscription.");
  if (subscription.schedule) throw new BillingError("FEATURED_ADDON_SCHEDULE_CONFLICT", "Your subscription already has a pending plan change. Manage this add-on from the Stripe billing portal.");
  const schedule = await getStripe().subscriptionSchedules.create({ from_subscription: subscription.id });
  const phase = schedule.phases[0];
  const end = item.current_period_end ?? Math.floor((account.currentPeriodEnd?.getTime() ?? Date.now()) / 1000);
  const baseItems = phase.items.filter((phaseItem) => { const id = typeof phaseItem.price === "string" ? phaseItem.price : phaseItem.price.id; return id !== price; }).map((phaseItem) => ({ price: typeof phaseItem.price === "string" ? phaseItem.price : phaseItem.price.id, quantity: phaseItem.quantity ?? 1 }));
  await getStripe().subscriptionSchedules.update(schedule.id, { end_behavior: "release", phases: [{ items: phase.items.map((phaseItem) => ({ price: typeof phaseItem.price === "string" ? phaseItem.price : phaseItem.price.id, quantity: phaseItem.quantity ?? 1 })), end_date: end }, { items: baseItems, start_date: end }] });
  await prisma.billingAccount.update({ where: { userId: user.id }, data: { featuredAddonCancelAtPeriodEnd: true, featuredAddonScheduleId: schedule.id, featuredAddonCurrentPeriodEnd: new Date(end * 1000) } });
  return { ok: true as const };
}

export async function selectFeaturedProject(projectId: string) {
  const user = await requireUser(); const entitlements = await getUserEntitlements(user.id);
  if (!entitlements.canSelectFeaturedProject) throw new BillingError("FEATURED_ADDON_REQUIRED", "Activate Featured Business before selecting a site.");
  const project = await prisma.websiteProject.findFirst({ where: { id: projectId, userId: user.id, isPublished: true, isDemo: false }, select: { id: true } });
  if (!project) throw new BillingError("FEATURED_PROJECT_INVALID", "Choose one of your published websites.");
  if (prisma.featuredBusiness.updateMany) await prisma.featuredBusiness.updateMany({ where: { enabled: true, project: { userId: user.id } }, data: { enabled: false } });
  await prisma.featuredBusiness.upsert({ where: { projectId }, create: { projectId, enabled: true }, update: { enabled: true } });
  return { ok: true as const };
}
