"use client";

import { useState, useTransition } from "react";
import { openBillingPortalAction, startCheckoutAction } from "@/app/actions/billing";
import type { PaidPlan } from "@/lib/billing/plans";

export function BillingButton({ plan, children }: { plan?: PaidPlan; children: React.ReactNode }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const open = () => startTransition(async () => {
    setError("");
    try {
      const result = plan ? await startCheckoutAction(plan) : await openBillingPortalAction();
      if (result.ok) window.location.assign(result.url);
      else setError(result.error);
    } catch { setError("We couldn't reach LaunchSite. Please try again."); }
  });
  return <div><button className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} onClick={open} type="button">{pending ? "Opening secure billing…" : children}</button><p className="mt-3 text-sm text-rose-700" aria-live="polite">{error}</p></div>;
}
