import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Brand } from "@/components/brand";
import { requireUser } from "@/lib/access";

const links = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/examples", label: "Examples" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#why-launchsite", label: "Why LaunchSite" },
];

export async function SiteHeader() {
  const session = await auth();
  const currentUser = session?.user ? await requireUser().catch(() => null) : null;

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return <header className="relative z-30 border-b border-slate-100 bg-white/90 backdrop-blur"><div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5 sm:px-8"><Brand /><nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">{links.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}</nav><div className="flex items-center gap-4">{session?.user ? <>{currentUser?.role === "ADMIN" && <Link className="text-sm font-semibold" href="/admin">Admin</Link>}<Link className="text-sm font-semibold" href="/dashboard">Dashboard</Link><Link className="hidden text-sm font-semibold sm:block" href="/account">{session.user.name ?? "Account"}</Link><form action={logout}><button className="text-sm font-semibold" type="submit">Sign out</button></form></> : <><Link className="text-sm font-semibold" href="/login">Sign in</Link><Link className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white" href="/signup">Create account</Link></>}</div></div></header>;
}
