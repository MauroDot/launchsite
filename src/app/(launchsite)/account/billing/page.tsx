import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getUserEntitlements } from "@/lib/billing/entitlements";
import { plans } from "@/lib/billing/plans";
import { BillingButton } from "@/components/billing-button";

export const metadata = { title: "Your billing" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const statusLabels: Record<string, string> = { active: "Active", trialing: "Trial", past_due: "Payment overdue", incomplete: "Payment incomplete", incomplete_expired: "Checkout expired", canceled: "Canceled", unpaid: "Unpaid", paused: "Paused" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  if (!(await auth())?.user) redirect("/login?callbackUrl=/account/billing");
  const user = await requireUser();
  const [entitlements, account] = await Promise.all([getUserEntitlements(user.id), prisma.billingAccount.findUnique({ where: { userId: user.id }, select: { stripeCustomerId: true } })]);
  const success = (await searchParams).checkout === "success";
  const date = entitlements.currentPeriodEnd?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
    <Link className="text-sm font-semibold text-slate-600" href="/account">Back to account</Link><h1 className="mt-5 text-4xl font-semibold">Your plan and billing</h1>
    {success && <div role="status" className="mt-6 rounded-xl bg-blue-50 p-5 text-blue-950"><p>{entitlements.hasActiveSubscription ? "Your subscription is confirmed. Your plan is ready to use." : "Thanks for returning from Checkout. We're confirming your subscription. Your plan will update once confirmation arrives."}</p><Link className="mt-3 inline-block font-semibold underline" href="/account/billing">Refresh billing status</Link></div>}
    <div className="mt-8 rounded-2xl border border-slate-200 p-6 sm:p-8"><p className="text-sm text-slate-500">Current plan</p><h2 className="mt-2 text-3xl font-semibold">{plans[entitlements.plan].name}</h2>
      {entitlements.subscriptionStatus && <p className="mt-3 text-slate-600">Status: {statusLabels[entitlements.subscriptionStatus] ?? "Awaiting billing confirmation"}</p>}
      {entitlements.canPublish ? <><p className="mt-4 text-slate-600">Publish up to {entitlements.maxPublishedSites} {entitlements.maxPublishedSites === 1 ? "website" : "websites"}.</p>{date && <p className="mt-2 text-slate-600">{entitlements.cancelAtPeriodEnd ? "Active until" : entitlements.subscriptionStatus === "trialing" ? "Trial ends" : "Current billing period ends"} {date} (UTC)</p>}{entitlements.cancelAtPeriodEnd && <p className="mt-2 font-medium text-amber-800">Cancellation scheduled. Publishing access continues while your subscription remains active.</p>}</> : <p className="mt-4 text-slate-600">Build, edit, and preview for free. Choose Starter or Business to publish. Previously published websites remain online until you unpublish them.</p>}
      {entitlements.subscriptionStatus === "past_due" && <p role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-amber-950">Your latest payment is overdue. Publishing remains available while Stripe retries payment. Please update your payment method in Manage billing.</p>}
      {["unpaid", "incomplete", "paused"].includes(entitlements.subscriptionStatus ?? "") && <p className="mt-5 rounded-xl bg-amber-50 p-4 text-amber-950">Your subscription needs attention before you can publish. Open Manage billing to review it.</p>}
      <div className="mt-7 flex flex-wrap items-start gap-4">{account?.stripeCustomerId && <BillingButton>Manage billing</BillingButton>}<Link className="rounded-full border px-5 py-3 text-sm font-semibold" href="/pricing">View plans</Link><Link className="rounded-full border px-5 py-3 text-sm font-semibold" href="/dashboard">Your websites</Link></div>
    </div>
    <p className="mt-6 text-sm text-slate-500">Payments and payment-method details are handled securely by Stripe.</p>
  </section>;
}
