import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ownerProject } from "./core";
import { METHODS, STATUSES } from "./validation";
export type PaymentFilters = { q?: string; method?: string; status?: string; from?: string; to?: string; page?: string };
export async function listPayments(projectId: string, filters: PaymentFilters) {
  await ownerProject(projectId);
  const page = Math.min(10000, Math.max(1, Number.parseInt(filters.page || "1", 10) || 1));
  const date = (value?: string) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(value).getTime()) ? new Date(value) : undefined;
  const from = date(filters.from), to = date(filters.to); if (to) to.setUTCDate(to.getUTCDate() + 1);
  const q = filters.q?.trim().slice(0, 150);
  const where: Prisma.CustomerPaymentWhereInput = { projectId,
    ...(["STRIPE", ...METHODS].includes(filters.method || "") ? { paymentMethod: filters.method as Prisma.EnumCustomerPaymentMethodFilter } : {}),
    ...(STATUSES.includes(filters.status as typeof STATUSES[number]) ? { paymentStatus: filters.status as typeof STATUSES[number] } : {}),
    ...(from || to ? { createdAt: { gte: from, lt: to } } : {}),
    ...(q ? { OR: ["customerName", "customerEmail", "receiptNumber", "externalReference"].map((field) => ({ [field]: { contains: q, mode: "insensitive" } })) } : {}),
  };
  const [items, total, summary] = await Promise.all([
    prisma.customerPayment.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 25, take: 25, select: { id: true, createdAt: true, receiptNumber: true, customerName: true, totalAmount: true, paymentMethod: true, paymentSource: true, paymentStatus: true } }),
    prisma.customerPayment.count({ where }),
    prisma.customerPayment.groupBy({ by: ["paymentSource"], where: { projectId, paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } }, _sum: { totalAmount: true, refundedAmount: true }, _count: { _all: true } }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / 25)), summary };
}
