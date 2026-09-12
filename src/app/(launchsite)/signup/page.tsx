import Link from "next/link";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export const metadata = { title: "Create your LaunchSite account" };

export default function SignupPage() {
  return <section className="mx-auto max-w-md px-5 py-20 text-center"><p className="eyebrow">Get started</p><h1 className="mt-4 text-3xl font-semibold">Create your LaunchSite account</h1><p className="mt-3 text-slate-600">Create your account securely with Google. You can use a Google Account associated with an existing non-Gmail email address.</p><GoogleSignInButton label="Create account with Google" /><p className="mt-6 text-sm text-slate-600">Already have an account? <Link className="font-semibold text-slate-900" href="/login">Sign in</Link></p><p className="mt-4 text-sm"><Link href="/">Back to LaunchSite</Link></p></section>;
}
