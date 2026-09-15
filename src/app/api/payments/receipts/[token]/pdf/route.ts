import { publicReceipt } from "@/lib/payments/receipts";
import { receiptPdf } from "@/lib/payments/pdf";
import { requestKey, tooManyResponse } from "@/lib/rate-limit";
import { limitPayments } from "@/lib/payments/core";
import { PaymentError } from "@/lib/payments/validation";
import { logOperationalError } from "@/lib/operational-logging";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    await limitPayments(requestKey(request, "receipt-pdf"), 20);
    const receipt = await publicReceipt((await params).token);
    if (!receipt) return new Response("Receipt unavailable.", { status: 404 });
    return new Response(new Uint8Array(await receiptPdf(receipt)), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="receipt-${receipt.receiptNumber}.pdf"`, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) {
    if (error instanceof PaymentError) return tooManyResponse(60);
    logOperationalError({ category: "APP", action: "public-receipt-pdf" });
    return new Response("The PDF is temporarily unavailable. Please try again.", { status: 503 });
  }
}
