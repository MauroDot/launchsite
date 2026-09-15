import "server-only";
import PDFDocument from "pdfkit";
import { createRequire } from "node:module";
import type { Receipt } from "./receipts";
import { formatMoney } from "./validation";

/** No stored PDFs, external image fetches, browser processes, or executable HTML. */
export async function receiptPdf(receipt: Receipt): Promise<Buffer> {
  const doc = new PDFDocument({ size: "LETTER", margin: 50, info: { Title: `Receipt ${receipt.receiptNumber}`, Author: receipt.businessName } });
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => { doc.on("data", (chunk: Buffer) => chunks.push(chunk)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const resolve = createRequire(`${process.cwd()}/package.json`).resolve;
  doc.font(resolve("@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff"));
  const line = (value: string, size = 11) => { doc.fontSize(size).text(value, { width: 512 }).moveDown(0.5); };
  line(receipt.businessName, 22);
  line([receipt.businessEmail, receipt.businessPhone].filter(Boolean).join(" | "));
  line(`Receipt ${receipt.receiptNumber}`, 16);
  line(`Status: ${receipt.paymentStatus.replaceAll("_", " ")}`);
  line(`Customer: ${receipt.customerName}${receipt.customerEmail ? ` (${receipt.customerEmail})` : ""}`);
  line(`Payment date: ${receipt.paidAt?.toISOString().slice(0, 10) ?? "—"}`);
  for (const item of receipt.lineItems) line(`${item.description}\n${item.quantity} x ${formatMoney(item.unitAmount)} = ${formatMoney(item.totalAmount)}`);
  line(`Subtotal: ${formatMoney(receipt.subtotal)}`);
  line(`Tax (entered by business): ${formatMoney(receipt.taxAmount)}`);
  line(`Discount: ${formatMoney(receipt.discountAmount)}`);
  line(`Total paid (USD): ${formatMoney(receipt.totalAmount)}`, 14);
  if (receipt.refundedAmount) line(`Recorded refunds: ${formatMoney(receipt.refundedAmount)}`);
  line(`Method: ${receipt.paymentMethod.replaceAll("_", " ")}`);
  if (receipt.externalReference) line(`Reference: ${receipt.externalReference}`);
  if (receipt.note) line(receipt.note);
  if (receipt.paymentSource === "MANUAL_EXTERNAL") line("Payment information recorded by the business. LaunchSite has not independently verified this payment.", 10);
  line("Business record only. Not accounting or tax advice.", 10);
  line(`Generated: ${new Date().toISOString().slice(0, 10)}`, 10);
  doc.end();
  return completed;
}
