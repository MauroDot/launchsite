"use client";

export default function SiteError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-xl px-5 py-24"><h1 className="text-3xl font-semibold">Website temporarily unavailable</h1><p className="mt-4">Please try again in a moment.</p><button className="mt-6 rounded-full border px-5 py-3" onClick={reset}>Try again</button></main>;
}
