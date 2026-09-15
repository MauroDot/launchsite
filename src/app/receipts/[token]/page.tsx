import { notFound } from "next/navigation";
import { publicReceipt } from "@/lib/payments/receipts";
import { ReceiptView } from "@/components/receipt-view";
export const dynamic = "force-dynamic";
export const metadata = { title: "Receipt", robots: { index: false, follow: false } };
export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const receipt = await publicReceipt(token);
  if (!receipt) notFound();
  return <main><ReceiptView receipt={receipt} pdfUrl={`/api/payments/receipts/${token}/pdf`} /></main>;
}
