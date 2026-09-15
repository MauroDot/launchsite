export class PaymentError extends Error {}
export const METHODS = ["PAYPAL", "VENMO", "CASH_APP", "BANK_TRANSFER", "CASH", "CHECK", "OTHER"] as const;
export const EXTERNAL_TYPES = ["PAYPAL", "VENMO", "CASH_APP", "BANK_PAYMENT_LINK", "OTHER"] as const;
export const STATUSES = ["PENDING", "PAID", "PARTIALLY_REFUNDED", "REFUNDED", "VOIDED", "FAILED"] as const;
export const MAX_AMOUNT = 1_000_000; // $10,000; an explicit MVP boundary.
export function text(value: unknown, label: string, max = 200, optional = false) {
  if (optional && (value === undefined || value === null || value === "")) return "";
  if (typeof value !== "string" || !value.trim() || value.trim().length > max || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(value)) throw new PaymentError(`Enter a valid ${label} (up to ${max} characters).`);
  return value.trim();
}
export function choice<T extends string>(value: unknown, options: readonly T[], label: string): T {
  if (!options.includes(value as T)) throw new PaymentError(`Choose a valid ${label}.`);
  return value as T;
}
export function integer(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw new PaymentError(`Enter a whole number from ${min} to ${max}.`);
  return value;
}
export function money(value: unknown, min = 0, max = MAX_AMOUNT) {
  if (typeof value !== "string" || !/^\d{1,7}(\.\d{1,2})?$/.test(value.trim())) throw new PaymentError("Enter a USD amount with at most two decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  return integer(Number(whole) * 100 + Number(fraction.padEnd(2, "0")), min, max);
}
export function formatMoney(amount: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount / 100); }
export function secureUrl(value: unknown) {
  const raw = text(value, "HTTPS payment URL", 2000);
  let url: URL;
  try { url = new URL(raw); } catch { throw new PaymentError("Enter a valid HTTPS payment URL."); }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".") || url.hostname === "localhost" || url.hostname.endsWith(".localhost") || /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(url.hostname)) throw new PaymentError("Use a publicly hosted HTTPS payment URL without login credentials.");
  return url.href;
}
export function email(value: unknown) {
  const result = text(value, "customer email", 254, true);
  if (result && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(result)) throw new PaymentError("Enter a valid customer email.");
  return result.toLowerCase() || null;
}
export function requestId(value: unknown) {
  if (typeof value !== "string" || !/^[a-f0-9-]{36}$/i.test(value)) throw new PaymentError("Reload the form and try again.");
  return value;
}
export function manualData(input: Record<string, unknown>) {
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 30) throw new PaymentError("Add between 1 and 30 receipt items.");
  const lineItems = input.items.map((row, position) => {
    if (!row || typeof row !== "object") throw new PaymentError("Invalid receipt item.");
    const item = row as Record<string, unknown>;
    const quantity = integer(item.quantity, 1, 1000);
    const unitAmount = money(item.unitAmount);
    return { description: text(item.description, "item description", 300), quantity, unitAmount, totalAmount: integer(quantity * unitAmount, 0, MAX_AMOUNT), position };
  });
  const subtotal = integer(lineItems.reduce((sum, item) => sum + item.totalAmount, 0), 1, MAX_AMOUNT);
  const taxAmount = money(input.taxAmount || "0");
  const discountAmount = money(input.discountAmount || "0", 0, subtotal);
  const totalAmount = integer(subtotal + taxAmount - discountAmount, 1, MAX_AMOUNT);
  const paidAtText = text(input.paidAt, "payment date", 10);
  const paidAt = new Date(`${paidAtText}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAtText) || !Number.isFinite(paidAt.getTime()) || paidAt.toISOString().slice(0, 10) !== paidAtText || paidAtText > new Date().toISOString().slice(0, 10) || paidAt.getUTCFullYear() < 2000) throw new PaymentError("Enter a valid payment date between 2000 and today.");
  return { customerName: text(input.customerName, "customer name", 150), customerEmail: email(input.customerEmail), customerPhone: text(input.customerPhone, "phone", 40, true) || null,
    description: lineItems.map((item) => item.description).join("; ").slice(0, 500), subtotal, taxAmount, discountAmount, totalAmount, paidAt,
    paymentMethod: choice(input.paymentMethod, METHODS, "payment method"), externalReference: text(input.externalReference, "external reference", 150, true) || null,
    note: text(input.note, "receipt note", 1000, true) || null, lineItems };
}
