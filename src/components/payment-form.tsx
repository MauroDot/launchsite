"use client";
import { useActionState, useEffect, useState } from "react";
import { paymentAction } from "@/app/actions/payments";
export function PaymentForm({ projectId, operation, children, button = "Save" }: { projectId: string; operation: string; children?: React.ReactNode; button?: string }) {
  const [state, action, pending] = useActionState(paymentAction.bind(null, projectId, operation), { ok: false, message: "" });
  useEffect(() => { if (state.ok && state.url) window.location.assign(state.url); }, [state]);
  return <form action={action} className="space-y-4"><fieldset disabled={pending} className="space-y-4">{children}<button className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Working…" : button}</button></fieldset>{state.message && <p role="status" className={`text-sm ${state.ok ? "text-green-800" : "text-red-700"}`}>{state.message}</p>}</form>;
}
export function ReceiptItems() {
  const [rows, setRows] = useState([0]);
  return <div className="space-y-3">{rows.map((key, index) => <div key={key} className="grid grid-cols-2 gap-3 rounded-xl border p-4 sm:grid-cols-4"><label className="col-span-2 text-sm">Item {index + 1}<input name="itemDescription" maxLength={300} required className="mt-1 w-full rounded-lg border p-2" /></label><label className="text-sm">Quantity<input name="quantity" type="number" defaultValue="1" min="1" max="1000" required className="mt-1 w-full rounded-lg border p-2" /></label><label className="text-sm">Unit price (USD)<input name="unitAmount" type="number" min="0" max="10000" step="0.01" required className="mt-1 w-full rounded-lg border p-2" /></label>{rows.length > 1 && <button type="button" className="text-left text-sm underline" onClick={() => setRows(rows.filter((row) => row !== key))}>Remove item {index + 1}</button>}</div>)}<button type="button" disabled={rows.length >= 30} className="text-sm font-semibold underline" onClick={() => setRows([...rows, Math.max(...rows) + 1])}>Add another item</button></div>;
}
