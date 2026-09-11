"use client";

import { useEffect, useState } from "react";

type GoogleSignInButtonProps = {
  label?: string;
  callbackUrl?: string;
};

/** Keeps Google authentication in the browser's CSRF-protected POST flow. */
export function GoogleSignInButton({ label = "Continue with Google", callbackUrl = "/dashboard" }: GoogleSignInButtonProps) {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/csrf", { credentials: "same-origin" })
      .then(async (response) => {
        const payload = await response.json() as { csrfToken?: string };
        if (!response.ok || !payload.csrfToken) throw new Error("CSRF token unavailable");
        if (active) setCsrfToken(payload.csrfToken);
      })
      .catch(() => {
        if (active) setError("We couldn't prepare Google sign-in. Please refresh and try again.");
      });
    return () => { active = false; };
  }, []);

  return <div className="mt-8"><form action="/api/auth/signin/google" method="POST"><input name="csrfToken" type="hidden" value={csrfToken ?? ""} /><input name="callbackUrl" type="hidden" value={callbackUrl} /><button className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={!csrfToken} type="submit">{label}</button></form>{!csrfToken && !error && <p className="mt-3 text-sm text-slate-500">Preparing secure sign-in…</p>}{error && <p className="mt-3 text-sm text-rose-700" role="alert">{error}</p>}</div>;
}
