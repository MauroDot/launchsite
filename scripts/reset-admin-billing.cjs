/* eslint-disable @typescript-eslint/no-require-imports -- standalone Prisma maintenance script. */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const emailArgumentIndex = process.argv.indexOf("--email");
const requestedEmail = emailArgumentIndex >= 0 ? process.argv[emailArgumentIndex + 1] : undefined;
const confirmed = args.has("--confirm");

const resetData = {
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  stripePriceId: null,
  plan: "FREE",
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
};

function resolveEmail() {
  if (requestedEmail && requestedEmail !== "--confirm") return requestedEmail.trim().toLowerCase();
  const configured = (process.env.ADMIN_EMAILS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (configured.length === 1) return configured[0];
  throw new Error("Provide the target administrator explicitly with --email <address>.");
}

function samePublishedState(before, after) {
  if (before.length !== after.length) return false;
  const normalize = (project) => ({
    id: project.id,
    isPublished: project.isPublished,
    publicSlug: project.publicSlug,
    publishedAt: project.publishedAt?.toISOString() ?? null,
    lastPublishedAt: project.lastPublishedAt?.toISOString() ?? null,
  });
  return before.map(normalize).every((project, index) => JSON.stringify(project) === JSON.stringify(normalize(after[index])));
}

async function main() {
  const email = resolveEmail();
  const before = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      billingAccount: { select: { id: true, plan: true, subscriptionStatus: true, stripeCustomerId: true, stripeSubscriptionId: true } },
      projects: { select: { id: true, isPublished: true, publicSlug: true, publishedAt: true, lastPublishedAt: true } },
    },
  });

  if (!before) throw new Error(`No user found for ${email}.`);
  if (before.role !== "ADMIN") throw new Error(`Refusing to reset ${email}: the account role is ${before.role}, not ADMIN.`);
  if (!before.billingAccount) throw new Error(`No BillingAccount row exists for ${email}; entitlement already resolves to FREE.`);

  const publishedBefore = before.projects.filter((project) => project.isPublished);
  console.log("Billing reset dry-run summary");
  console.log(`Target user: ${before.email} (${before.id})`);
  console.log(`Billing row: ${before.billingAccount.id}`);
  console.log(`Current plan/status: ${before.billingAccount.plan} / ${before.billingAccount.subscriptionStatus ?? "none"}`);
  console.log(`Current Stripe IDs: customer=${before.billingAccount.stripeCustomerId ?? "none"}, subscription=${before.billingAccount.stripeSubscriptionId ?? "none"}`);
  console.log(`Projects: ${before.projects.length}; published projects: ${publishedBefore.length}`);
  console.log("Will update only this BillingAccount row with:");
  console.log(JSON.stringify(resetData, null, 2));

  if (!confirmed) {
    console.log("Dry run only. Re-run the same command with --confirm after reviewing this summary.");
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.billingAccount.findUnique({ where: { id: before.billingAccount.id }, select: { userId: true } });
    if (!current || current.userId !== before.id) throw new Error("Billing row changed before confirmation; no update was made.");
    await tx.billingAccount.update({ where: { id: before.billingAccount.id }, data: resetData });
    return tx.user.findUnique({
      where: { id: before.id },
      select: {
        id: true,
        email: true,
        role: true,
        billingAccount: { select: { id: true, plan: true, subscriptionStatus: true, stripeCustomerId: true, stripeSubscriptionId: true, cancelAtPeriodEnd: true } },
        projects: { select: { id: true, isPublished: true, publicSlug: true, publishedAt: true, lastPublishedAt: true } },
      },
    });
  });

  if (!result || result.id !== before.id || result.email !== before.email || result.role !== before.role) throw new Error("Verification failed: user identity or admin role changed.");
  if (!result.billingAccount || result.billingAccount.id !== before.billingAccount.id || result.billingAccount.plan !== "FREE" || result.billingAccount.subscriptionStatus !== null || result.billingAccount.stripeCustomerId !== null || result.billingAccount.stripeSubscriptionId !== null || result.billingAccount.cancelAtPeriodEnd !== false) throw new Error("Verification failed: billing state was not reset to FREE.");
  if (result.projects.length !== before.projects.length || !samePublishedState(before.projects, result.projects)) throw new Error("Verification failed: project or published-site state changed.");

  console.log("Reset applied and verified.");
  console.log(`User preserved: ${result.email}; role preserved: ${result.role}`);
  console.log(`Projects preserved: ${result.projects.length}; published projects preserved: ${result.projects.filter((project) => project.isPublished).length}`);
  console.log("Entitlement state: FREE (no active Stripe subscription)");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
