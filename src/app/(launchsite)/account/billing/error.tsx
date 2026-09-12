"use client";

export default function BillingErrorPage({ reset }: { reset: () => void }) {
  return <section className="mx-auto max-w-3xl px-5 py-16"><h1 className="text-3xl font-semibold">Billing is temporarily unavailable</h1><p className="mt-4">We could not load your plan. Please try again in a moment.</p><button className="mt-6 rounded-full border px-5 py-3" onClick={reset}>Try again</button></section>;
}
