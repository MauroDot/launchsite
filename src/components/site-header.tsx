"use client";

import Link from "next/link";
import { useState } from "react";
import { Brand } from "@/components/brand";

const links = [{ href: "/#how-it-works", label: "How it works" }, { href: "/examples", label: "Examples" }, { href: "/#why-launchsite", label: "Why LaunchSite" }];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="relative z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Brand />
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          {links.map((link) => <Link className="transition hover:text-slate-950" href={link.href} key={link.href}>{link.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-4 md:flex">
          <Link className="text-sm font-semibold text-slate-700 transition hover:text-slate-950" href="/login">Sign in</Link>
          <Link className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700" href="/register">Create my site</Link>
        </div>
        <button aria-expanded={open} aria-label="Toggle navigation" className="rounded-lg p-2 text-slate-700 md:hidden" onClick={() => setOpen(!open)} type="button">
          <span className="block h-0.5 w-5 bg-current" />
          <span className="mt-1 block h-0.5 w-5 bg-current" />
        </button>
      </div>
      {open && <div className="absolute inset-x-0 border-b border-slate-100 bg-white px-5 py-5 shadow-lg md:hidden">
        <nav className="mx-auto flex max-w-6xl flex-col gap-4 text-sm font-medium text-slate-700">
          {links.map((link) => <Link href={link.href} key={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}
          <hr className="border-slate-100" />
          <Link href="/login" onClick={() => setOpen(false)}>Sign in</Link>
          <Link className="w-fit rounded-full bg-slate-900 px-4 py-2.5 font-semibold text-white" href="/register" onClick={() => setOpen(false)}>Create my site</Link>
        </nav>
      </div>}
    </header>
  );
}
