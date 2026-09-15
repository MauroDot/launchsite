import "server-only";
import { randomBytes } from "node:crypto";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { getAppUrl } from "@/lib/app-url";
import { limitPayments, ownerProject, withPaymentLock } from "./core";
import { email, PaymentError } from "./validation";
import type { Prisma } from "@prisma/client";

export const receiptSelect = {
  businessName: true, businessEmail: true, businessPhone: true, receiptNumber: true, receiptIssuedAt: true,
  customerName: true, customerEmail: true, description: true, paidAt: true, subtotal: true, taxAmount: true, discountAmount: true,
  totalAmount: true, refundedAmount: true, currency: true, paymentMethod: true, paymentSource: true, paymentStatus: true,
  externalReference: true, note: true, stripeReceiptUrl: true,
  lineItems: { orderBy: { position: "asc" }, select: { description: true, quantity: true, unitAmount: true, totalAmount: true } },
} satisfies Prisma.CustomerPaymentSelect;
export type Receipt = Prisma.CustomerPaymentGetPayload<{ select: typeof receiptSelect }>;
export async function publicReceipt(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return prisma.customerPayment.findFirst({ where: { receiptToken: token, receiptNumber: { not: null } }, select: receiptSelect });
}
export async function ownerReceipt(projectId: string, paymentId: string) {
  await ownerProject(projectId);
  return prisma.customerPayment.findFirst({ where: { id: paymentId, projectId, receiptNumber: { not: null } }, select: receiptSelect });
}
export async function changeReceiptAccess(projectId: string, paymentId: string, enable: boolean) {
  const { user } = await ownerProject(projectId);
  await limitPayments(`receipt-access:${user.id}`, 20);
  await withPaymentLock(projectId, async (tx) => {
    await ownerProject(projectId, tx);
    const result = await tx.customerPayment.updateMany({ where: { id: paymentId, projectId, receiptNumber: { not: null } }, data: { receiptToken: enable ? randomBytes(32).toString("hex") : null } });
    if (!result.count) throw new PaymentError("Receipt not found.");
  });
}
export function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
export async function emailReceipt(projectId: string, paymentId: string) {
  const { user } = await ownerProject(projectId);
  await limitPayments(`receipt-email:${user.id}`, 10, 60 * 60 * 1000);
  await limitPayments(`receipt-email:${paymentId}`, 1, 60_000);
  const row = await prisma.customerPayment.findFirst({ where: { id: paymentId, projectId, receiptNumber: { not: null } }, select: { customerEmail: true, receiptToken: true, businessName: true, receiptNumber: true, paymentSource: true } });
  if (!row?.receiptToken) throw new PaymentError("Enable receipt sharing before emailing this receipt.");
  const recipient = email(row.customerEmail);
  if (!recipient) throw new PaymentError("This payment has no customer email address.");
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.LEAD_NOTIFICATION_FROM?.trim();
  if (!key || !from) throw new PaymentError("Receipt email is not configured. Your payment record is saved.");
  const link = `${getAppUrl()}/receipts/${row.receiptToken}`;
  const result = await new Resend(key).emails.send({ from, to: [recipient], subject: `Receipt ${row.receiptNumber} from ${row.businessName.replace(/[\r\n]/g, " ")}`,
    html: `<p>Your receipt from ${escapeHtml(row.businessName)} is available.</p><p><a href="${escapeHtml(link)}">View and download receipt ${escapeHtml(row.receiptNumber!)}</a></p>${row.paymentSource === "MANUAL_EXTERNAL" ? "<p>Payment information recorded by the business. LaunchSite has not independently verified this payment.</p>" : ""}`,
  }, { idempotencyKey: `receipt:${paymentId}:${Math.floor(Date.now() / 60_000)}` });
  if (result.error || !result.data?.id) throw new PaymentError("Receipt email could not be sent. Your payment record is saved; try again later.");
}
