import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/access";
import { receiptSelect } from "@/lib/payments/receipts";
import { receiptPdf } from "@/lib/payments/pdf";
import { limitPayments } from "@/lib/payments/core";
import { PaymentError } from "@/lib/payments/validation";
import { tooManyResponse } from "@/lib/rate-limit";
import { logOperationalError } from "@/lib/operational-logging";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch { return new Response("Sign in to view this receipt.", { status: 401 }); }
  try {
    await limitPayments(`owner-pdf:${user.id}`, 30);
    const receipt = await prisma.customerPayment.findFirst({ where: { id: (await params).id, project: { userId: user.id }, receiptNumber: { not: null } }, select: receiptSelect });
    if (!receipt) return new Response("Receipt unavailable.", { status: 404 });
    return new Response(new Uint8Array(await receiptPdf(receipt)), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="receipt-${receipt.receiptNumber}.pdf"`, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) {
    if (error instanceof PaymentError) return tooManyResponse(60);
    logOperationalError({ category: "APP", action: "owner-receipt-pdf" });
    return new Response("The PDF is temporarily unavailable. Please try again.", { status: 503 });
  }
}
