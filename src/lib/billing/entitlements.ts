import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProjectOwner } from "@/lib/project-ownership";
import { entitlementsFromBilling } from "./policy";
import { BillingError } from "./errors";

export async function getUserEntitlements(userId: string, db: Prisma.TransactionClient = prisma) {
  return entitlementsFromBilling(await db.billingAccount.findUnique({ where: { userId } }));
}

export async function requirePublishEntitlement(user: ProjectOwner, project: { isDemo: boolean; isPublished: boolean }, db: Prisma.TransactionClient) {
  if (user.role === "ADMIN" && project.isDemo) return;
  const entitlements = await getUserEntitlements(user.id, db);
  if (!entitlements.canPublish) throw new BillingError("PUBLISH_REQUIRES_PAID_PLAN", "Publishing is available on Starter and Business plans. Choose a plan to put your website online.");
  // Grandfather already-published sites even if an account is over its limit.
  if (project.isPublished) return;
  const count = await db.websiteProject.count({ where: { userId: user.id, isPublished: true } });
  if (count >= entitlements.maxPublishedSites) throw new BillingError("PUBLISHED_SITE_LIMIT_REACHED", `Your plan allows ${entitlements.maxPublishedSites} published ${entitlements.maxPublishedSites === 1 ? "website" : "websites"}. Unpublish another site or choose a plan with more room.`);
}
