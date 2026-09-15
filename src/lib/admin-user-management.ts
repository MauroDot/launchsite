import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/access";
import { blocksNewSubscription } from "@/lib/billing/policy";

const resetBillingData = {
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  stripePriceId: null,
  plan: "FREE" as const,
  subscriptionStatus: null,
  subscriptionCreatedAt: null,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  checkoutSessionId: null,
  checkoutAttemptId: null,
  checkoutPlan: null,
  checkoutPriceId: null,
  checkoutExpiresAt: null,
  pendingPlan: null,
  pendingPlanEffectiveAt: null,
  stripeSubscriptionScheduleId: null,
};

function audit(adminId: string, targetId: string, action: string) {
  console.info("Admin user-management action", { actingAdminUserId: adminId, targetUserId: targetId, action, timestamp: new Date().toISOString() });
}

export async function listAdminUsers() {
  await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, email: true, image: true, role: true, createdAt: true,
      _count: { select: { projects: true } },
      projects: { where: { isPublished: true }, select: { id: true } },
      billingAccount: { select: { plan: true, subscriptionStatus: true, stripeCustomerId: true, stripeSubscriptionId: true } },
    },
  });
  return users.map(({ projects, billingAccount, ...user }) => ({
    ...user,
    publishedProjectCount: projects.length,
    billingPlan: billingAccount?.plan ?? "FREE",
    billingStatus: billingAccount?.subscriptionStatus ?? null,
    hasStripeCustomer: Boolean(billingAccount?.stripeCustomerId),
    hasStripeSubscription: Boolean(billingAccount?.stripeSubscriptionId),
  }));
}

export async function resetUserBilling(targetId: string, confirmationEmail?: string, confirmStripeSubscription = false) {
  const admin = await requireAdmin();
  if (targetId === admin.id) throw new Error("For safety, an administrator cannot reset their own billing here.");
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, email: true, role: true, billingAccount: { select: { stripeSubscriptionId: true, subscriptionStatus: true } } } });
  if (!target) throw new Error("User not found.");
  if (target.role === "ADMIN") throw new Error("Administrator billing must be managed separately.");
  const activeStripeSubscription = Boolean(target.billingAccount?.stripeSubscriptionId && blocksNewSubscription(target.billingAccount.subscriptionStatus));
  if (activeStripeSubscription && (!confirmStripeSubscription || !confirmationEmail || confirmationEmail.trim().toLowerCase() !== target.email?.trim().toLowerCase())) {
    throw new Error("An active Stripe subscription exists. Confirm that this action only clears LaunchSite billing and leaves Stripe unchanged by entering the user's email.");
  }
  await prisma.billingAccount.update({ where: { userId: target.id }, data: resetBillingData }).catch((error) => {
    if (error?.code === "P2025") return null;
    throw error;
  });
  audit(admin.id, target.id, "reset-billing");
}

export async function deleteUser(targetId: string, confirmationEmail: string) {
  const admin = await requireAdmin();
  if (targetId === admin.id) throw new Error("You cannot delete your own administrator account.");
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, email: true, role: true } });
  if (!target) throw new Error("User not found.");
  if (target.role === "ADMIN") throw new Error("Administrator accounts cannot be deleted here.");
  if (!target.email || confirmationEmail.trim().toLowerCase() !== target.email.toLowerCase()) throw new Error("Type the user's email exactly to confirm deletion.");

  await prisma.$transaction(async (tx) => {
    const merchantProjects = await tx.websiteProject.count({ where: { userId: target.id, OR: [
      { paymentSettings: { isNot: null } }, { paymentItems: { some: {} } }, { customerPayments: { some: {} } },
    ] } });
    if (merchantProjects) throw new Error("This user has merchant payment configuration or records. Contact support to retain their receipts and close the connected account before account deletion.");
    await tx.billingAccount.deleteMany({ where: { userId: target.id } });
    // Preserve shared/demo sites by detaching them; customer-owned sites and all
    // of their dependent content are deleted explicitly before the user.
    await tx.websiteProject.updateMany({ where: { userId: target.id, isDemo: true }, data: { userId: null } });
    await tx.websiteProject.deleteMany({ where: { userId: target.id, isDemo: false } });
    await tx.account.deleteMany({ where: { userId: target.id } });
    await tx.session.deleteMany({ where: { userId: target.id } });
    await tx.user.delete({ where: { id: target.id } });
  });
  audit(admin.id, target.id, "delete-user");
}
