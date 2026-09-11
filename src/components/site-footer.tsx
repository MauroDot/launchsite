import Link from "next/link";
import { Brand } from "@/components/brand";

export function SiteFooter() {
  return <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-8"><Brand /><p className="text-sm text-slate-500">© {new Date().getFullYear()} LaunchSite. Built for small businesses.</p><div className="flex gap-5 text-sm text-slate-500"><Link href="/login">Sign in</Link><Link href="/signup">Create account</Link></div></div></footer>;
}
