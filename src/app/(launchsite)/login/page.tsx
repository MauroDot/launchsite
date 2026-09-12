import Link from "next/link";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const requested = (await searchParams).callbackUrl;
  const callbackUrl = ["/pricing", "/account", "/account/billing", "/dashboard"].includes(requested ?? "") ? requested : "/dashboard";
  return <section className="mx-auto max-w-md px-5 py-20 text-center"><p className="eyebrow">Welcome back</p><h1 className="mt-4 text-3xl font-semibold">Sign in to LaunchSite</h1><p className="mt-3 text-slate-600">Continue with Google to securely access your workspace. You can use a Google Account associated with any email address—it does not need to be Gmail.</p><GoogleSignInButton callbackUrl={callbackUrl} /><p className="mt-6 text-sm text-slate-600">New to LaunchSite? <Link className="font-semibold text-slate-900" href="/signup">Create an account</Link></p><p className="mt-4 text-sm"><Link href="/">Back to LaunchSite</Link></p></section>;
}
