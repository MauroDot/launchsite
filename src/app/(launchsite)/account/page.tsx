import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireUser } from "@/lib/access";
import { getUserEntitlements } from "@/lib/billing/entitlements";
import { plans } from "@/lib/billing/plans";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/account");
  const user = await requireUser();
  const entitlements = await getUserEntitlements(user.id);

  return <section className="mx-auto max-w-3xl px-5 py-16"><p className="eyebrow">Account</p><h1 className="mt-4 text-3xl font-semibold">Your account</h1><dl className="mt-8 rounded-xl border p-6"><dt className="text-sm text-slate-500">Name</dt><dd className="mb-5 font-semibold">{session.user.name ?? "Not provided"}</dd><dt className="text-sm text-slate-500">Email</dt><dd className="font-semibold">{session.user.email}</dd></dl><section className="mt-6 rounded-xl border p-6"><h2 className="text-lg font-semibold">Plan and billing</h2><p className="mt-2 text-slate-600">Current plan: <strong>{plans[entitlements.plan].name}</strong>{entitlements.subscriptionStatus ? ` · ${entitlements.subscriptionStatus}` : ""}</p><p className="mt-2 text-slate-600">View your plan, upgrade for publishing, or manage your subscription.</p><Link className="mt-4 inline-block font-semibold underline" href="/account/billing">View billing</Link></section><section className="mt-6 rounded-xl border p-6"><h2 className="text-lg font-semibold">Your workspace</h2><div className="mt-3 flex flex-wrap gap-4"><Link className="font-semibold underline" href="/dashboard">Projects</Link><Link className="font-semibold underline" href="/dashboard/leads">Leads</Link><Link className="font-semibold underline" href="/dashboard/analytics">Analytics</Link></div></section><section className="mt-6 rounded-xl border p-6"><h2 className="text-lg font-semibold">Authentication</h2><p className="mt-2 font-medium">Signed in with Google</p><p className="mt-1 text-sm text-slate-600">Password and account-security changes are managed through your Google account.</p></section></section>;
}
