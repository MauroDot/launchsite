import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ownerProject } from "@/lib/payments/core";
import { ownerReceipt } from "@/lib/payments/receipts";
import { getAppUrl } from "@/lib/app-url";
import { ReceiptView } from "@/components/receipt-view";
import { PaymentForm } from "@/components/payment-form";
export const dynamic = "force-dynamic";
export default async function PaymentDetail({ params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const { id, paymentId } = await params;
  if (!await ownerProject(id).catch(() => null)) notFound();
  const payment = await prisma.customerPayment.findFirst({ where: { id: paymentId, projectId: id }, select: { receiptToken: true, paymentStatus: true, paymentSource: true, customerEmail: true } });
  if (!payment) notFound();
  const receipt = await ownerReceipt(id, paymentId);
  return <section className="mx-auto max-w-3xl px-5 py-10"><Link className="text-sm font-semibold underline print:hidden" href={`/dashboard/projects/${id}/payments`}>Back to payments</Link>{receipt ? <><ReceiptView receipt={receipt} pdfUrl={`/api/payments/owner-receipt/${paymentId}/pdf`} /><aside className="space-y-5 rounded-xl border p-5 print:hidden"><h2 className="text-xl font-semibold">Share receipt</h2><p className="text-sm text-slate-600">Anyone with the receipt link can view this receipt. Revoke sharing to disable old links.</p>{payment.receiptToken && <a className="block break-all text-sm underline" href={`${getAppUrl()}/receipts/${payment.receiptToken}`}>Open customer receipt link</a>}<PaymentForm projectId={id} operation="access" button={payment.receiptToken ? "Revoke public link" : "Enable a new public link"}><input name="paymentId" type="hidden" value={paymentId} /><input name="enable" type="hidden" value={payment.receiptToken ? "no" : "yes"} /></PaymentForm>{payment.customerEmail && payment.receiptToken && <PaymentForm projectId={id} operation="email" button={`Email receipt to ${payment.customerEmail}`}><input name="paymentId" type="hidden" value={paymentId} /></PaymentForm>}</aside></> : <div className="my-8"><h1 className="text-3xl font-semibold">Payment {payment.paymentStatus.toLowerCase()}</h1><p className="mt-4">A receipt becomes available after payment confirmation. Returning from checkout does not confirm payment.</p></div>}
    {payment.paymentSource === "MANUAL_EXTERNAL" && !["REFUNDED", "VOIDED"].includes(payment.paymentStatus) && <details className="mt-6 rounded-xl border p-5 print:hidden"><summary className="cursor-pointer font-semibold">Record an external refund or void</summary><p className="my-4 text-sm">This updates your records only. Return money through the original payment provider yourself. Changes are final.</p><PaymentForm projectId={id} operation="status" button="Update payment record"><input type="hidden" name="paymentId" value={paymentId} /><label className="block text-sm">Record status<select name="status" className="mt-1 w-full rounded-lg border p-3"><option value="PARTIALLY_REFUNDED">Partially refunded</option><option value="REFUNDED">Fully refunded</option><option value="VOIDED">Void incorrect record</option></select></label><label className="block text-sm">Total refunded so far (USD; for partial refund)<input name="refundedAmount" type="number" min="0.01" step="0.01" className="mt-1 w-full rounded-lg border p-3" /></label></PaymentForm></details>}
  </section>;
}
