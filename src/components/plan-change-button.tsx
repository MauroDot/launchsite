"use client";

import { useState, useTransition } from "react";
import { changePlanAction } from "@/app/actions/billing";
import type { PaidPlan } from "@/lib/billing/plans";

export function PlanChangeButton({ target, children }: { target: PaidPlan; children: React.ReactNode }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const change = () => startTransition(async () => {
    setMessage("");
    const result = await changePlanAction(target);
    setMessage(result.ok ? result.kind === "downgrade-scheduled" ? `Downgrade scheduled for ${new Date(result.effectiveAt!).toLocaleDateString()}.` : "Upgrade requested. Billing will update after Stripe confirms payment.": result.error);
  });
  return <div><button className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} onClick={change} type="button">{pending ? "Updating billing..." : children}</button>{message && <p className="mt-3 text-sm" role="status">{message}</p>}</div>;
}
