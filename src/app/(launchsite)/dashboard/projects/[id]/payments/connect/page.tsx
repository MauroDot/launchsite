import Link from "next/link";
import { PaymentForm } from "@/components/payment-form";
import { refreshConnect } from "@/lib/payments/service";
import { ownerProject } from "@/lib/payments/core";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function ConnectReturn({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ flow?: string }> }) {
  const { id } = await params;
  if (!await ownerProject(id).catch(() => null)) notFound();
  const refresh = (await searchParams).flow === "refresh";
  let updated = false;
  if (!refresh) { try { await refreshConnect(id); updated = true; } catch { /* Authenticated retry offered below. */ } }
  return <section className="mx-auto max-w-xl px-6 py-16"><h1 className="text-3xl font-semibold">{refresh ? "Continue Stripe setup" : "Welcome back from Stripe"}</h1><p className="my-5">{refresh ? "Your setup link has expired or was already used. Open a fresh link to continue securely." : updated ? "Your account status has been refreshed. Stripe may still need information before payments or payouts are available." : "We could not refresh Stripe status yet. Try again from your Payments screen."}</p>{refresh && <PaymentForm projectId={id} operation="connect" button="Continue Stripe setup" />}<Link className="mt-6 inline-block font-semibold underline" href={`/dashboard/projects/${id}/payments`}>Back to payments</Link></section>;
}
