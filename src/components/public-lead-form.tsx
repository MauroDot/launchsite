"use client";
import { useState } from "react";
export function PublicLeadForm({ slug, style, inputStyle }: { slug: string; style?: React.CSSProperties; inputStyle?: React.CSSProperties }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  return <form className="mt-6 space-y-3" onSubmit={async (event) => { event.preventDefault(); setState("sending"); setError(""); const form = new FormData(event.currentTarget); const response = await fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, name: form.get("name"), email: form.get("email"), phone: form.get("phone"), message: form.get("message"), website: form.get("website") }) }); const result = await response.json().catch(() => null); if (!response.ok) { setState("error"); setError(result?.error ?? "We could not send your message."); } else { setState("sent"); event.currentTarget.reset(); } }} style={style}>
    <label className="block text-sm font-semibold">Name<input required name="name" maxLength={120} className="mt-1 w-full rounded border p-3" style={inputStyle} /></label>
    <label className="block text-sm font-semibold">Email<input required name="email" type="email" maxLength={254} className="mt-1 w-full rounded border p-3" style={inputStyle} /></label>
    <label className="block text-sm font-semibold">Phone <span className="font-normal opacity-70">(optional)</span><input name="phone" maxLength={40} className="mt-1 w-full rounded border p-3" style={inputStyle} /></label>
    <label className="block text-sm font-semibold">Message<textarea required name="message" maxLength={5000} rows={4} className="mt-1 w-full rounded border p-3" style={inputStyle} /></label>
    <label aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden" tabIndex={-1}>Website<input autoComplete="off" name="website" tabIndex={-1} /></label>
    <button className="w-full px-4 py-3 text-sm font-semibold" disabled={state === "sending"} type="submit">{state === "sending" ? "Sending…" : "Send message"}</button>
    {state === "sent" && <p className="text-sm" role="status">Thanks — your message has been sent.</p>}{state === "error" && <p className="text-sm text-rose-700" role="alert">{error}</p>}
  </form>;
}
