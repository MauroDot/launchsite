import Link from "next/link";

export function Brand() {
  return (
    <Link aria-label="LaunchSite home" className="flex items-center gap-2 font-bold tracking-[-0.04em] text-slate-900" href="/">
      <span className="grid size-8 place-items-center rounded-lg bg-slate-900 text-sm text-lime-300">L</span>
      <span>LaunchSite</span>
    </Link>
  );
}
