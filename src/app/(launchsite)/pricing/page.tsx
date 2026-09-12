import Link from "next/link";
import { auth } from "@/auth";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { plans, type Plan } from "@/lib/billing/plans";
import { blocksNewSubscription, entitlementsFromBilling } from "@/lib/billing/policy";
import { BillingButton } from "@/components/billing-button";

export const metadata = { title: "Plans and pricing", description: "Build for free. Publish your business website with a LaunchSite monthly plan." };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const session = await auth();
  const user = session?.user ? await requireUser() : null;
  const account = user ? await prisma.billingAccount.findUnique({ where: { userId: user.id } }) : null;
  const entitlements = entitlementsFromBilling(account);
  const manage = Boolean(account?.stripeSubscriptionId && blocksNewSubscription(account.subscriptionStatus));
  const canceled = (await searchParams).checkout === "canceled";
  return <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
    <div className="max-w-2xl"><p className="eyebrow">Plans that grow with you</p><h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">Build for free. Publish when you’re ready.</h1><p className="mt-5 text-lg leading-8 text-slate-600">Start with your business, refine your website, then choose the publishing plan that fits. All paid plans are billed monthly in USD.</p></div>
    {canceled && <p role="status" className="mt-6 rounded-xl border border-slate-200 p-4">Checkout was canceled. Your plan has not changed.</p>}
    <div className="mt-10 grid gap-6 lg:grid-cols-3">{(Object.keys(plans) as Plan[]).map((key) => {
      const plan = plans[key];
      const current = user && entitlements.plan === key;
      return <article key={key} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-semibold">{plan.name}</h2>{current && <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-semibold text-lime-900">Current plan</span>}</div>
        <p className="mt-4"><span className="text-4xl font-semibold">${plan.monthlyPrice}</span><span className="text-slate-500">{key === "FREE" ? " forever" : " / month"}</span></p>
        <p className="mt-4 text-slate-600">{plan.description}</p>
        <ul className="my-7 flex-1 space-y-3 text-sm text-slate-700">{plan.features.map((feature) => <li className="flex gap-3" key={feature}><span aria-hidden="true" className="text-lime-700">✓</span>{feature}</li>)}</ul>
        {key === "FREE" ? <Link className="inline-block rounded-full border px-5 py-3 text-center text-sm font-semibold" href={user ? "/dashboard" : "/signup"}>{user ? "Go to your websites" : "Start building"}</Link> : !user ? <Link className="inline-block rounded-full bg-slate-900 px-5 py-3 text-center text-sm font-semibold text-white" href="/login?callbackUrl=/pricing">Sign in to choose {plan.name}</Link> : manage ? <BillingButton>Manage billing</BillingButton> : <BillingButton plan={key}>Choose {plan.name}</BillingButton>}
      </article>;
    })}</div>
    <p className="mt-8 max-w-3xl text-sm leading-6 text-slate-600">Every paid plan includes the current editor and AI content tools. Business gives you room to publish more sites. You can manage or cancel your subscription through secure Stripe billing.</p>
    {user && <Link className="mt-5 inline-block text-sm font-semibold underline" href="/account/billing">View your billing details</Link>}
  </section>;
}
