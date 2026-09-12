import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Cross-process lock: publishing counts, checkout, and webhook writes serialize
 * for one account, including across Vercel instances. Locks release on rollback. */
export function withBillingLock<T>(userId: string, work: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`billing:${userId}`}, 0))::text`;
    return work(tx);
  }, { maxWait: 5000, timeout: 55000 });
}
