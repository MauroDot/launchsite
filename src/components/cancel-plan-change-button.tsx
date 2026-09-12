"use client";

import { useState, useTransition } from "react";
import { cancelPlanChangeAction } from "@/app/actions/billing";

export function CancelPlanChangeButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  return <div><button className="rounded-full border px-5 py-3 text-sm font-semibold" disabled={pending} onClick={() => startTransition(async () => { const result = await cancelPlanChangeAction(); if (result.ok) window.location.reload(); else setMessage(result.error); })} type="button">Cancel scheduled downgrade</button>{message && <p className="mt-2 text-sm text-rose-700" role="alert">{message}</p>}</div>;
}
