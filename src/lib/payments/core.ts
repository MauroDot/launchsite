import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/access";
import { getUserEntitlements } from "@/lib/billing/entitlements";
import { PaymentError } from "./validation";

export function withPaymentLock<T>(projectId: string, work: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`merchant:${projectId}`}, 0))::text`;
    return work(tx);
  }, { maxWait: 5000, timeout: 55000 });
}
export async function ownerProject(projectId: string, db: Prisma.TransactionClient = prisma) {
  const user = await requireUser();
  const project = await db.websiteProject.findFirst({ where: { id: projectId, userId: user.id }, include: { paymentSettings: true, domain: true } });
  if (!project) throw new PaymentError("Project not found or you do not own it.");
  return { project, user };
}
export async function requirePaid(userId: string, db: Prisma.TransactionClient = prisma) {
  if (!(await getUserEntitlements(userId, db)).canAcceptCustomerPayments) throw new PaymentError("Choose Starter or Business to accept card payments or record new payments.");
}
export async function limitPayments(key: string, limit: number, windowMs = 60_000, db: Prisma.TransactionClient = prisma) {
  const now = new Date();
  const hashed = createHash("sha256").update(key).digest("hex");
  const rows = await db.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "PaymentRateLimit" ("key", "count", "resetAt") VALUES (${hashed}, 1, ${new Date(now.getTime() + windowMs)})
    ON CONFLICT ("key") DO UPDATE SET
    "count" = CASE WHEN "PaymentRateLimit"."resetAt" <= ${now} THEN 1 ELSE "PaymentRateLimit"."count" + 1 END,
    "resetAt" = CASE WHEN "PaymentRateLimit"."resetAt" <= ${now} THEN EXCLUDED."resetAt" ELSE "PaymentRateLimit"."resetAt" END
    RETURNING "count"`;
  if (rows[0].count > limit) throw new PaymentError("Too many payment requests. Please try again later.");
}
export async function issueReceipt(tx: Prisma.TransactionClient, paymentId: string, projectId: string) {
  const payment = await tx.customerPayment.findFirst({ where: { id: paymentId, projectId } });
  if (!payment || payment.receiptNumber || !["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(payment.paymentStatus)) return;
  const settings = await tx.projectPaymentSettings.upsert({ where: { projectId }, create: { projectId, receiptSequence: 1 }, update: { receiptSequence: { increment: 1 } } });
  await tx.customerPayment.update({ where: { id: paymentId }, data: { receiptNumber: `LS-${String(settings.receiptSequence).padStart(6, "0")}`, receiptIssuedAt: new Date(), receiptToken: randomBytes(32).toString("hex") } });
}
