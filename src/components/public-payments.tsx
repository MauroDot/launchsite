import { randomUUID } from "node:crypto";
import { getAppUrl } from "@/lib/app-url";
import { publicPaymentOptions } from "@/lib/payments/service";
import { formatMoney } from "@/lib/payments/validation";

export async function PublicPayments({ slug }: { slug?: string }) {
  if (!slug) return null;
  const { links, items } = await publicPaymentOptions(slug);
  if (!links.length && !items.length) return null;
  return <section aria-labelledby="payments-title" className="mx-auto max-w-6xl px-6 py-12"><h2 id="payments-title" className="text-3xl font-semibold">Payments</h2>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{links.map((link, index) => <article key={index} className="rounded-2xl border p-6"><a className="font-semibold underline" href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>{link.instructions && <p className="mt-3 whitespace-pre-wrap text-sm">{link.instructions}</p>}<p className="mt-3 text-xs text-slate-500">Opens an external payment provider. Payment is arranged directly with the business.</p></article>)}
    {items.map((item) => <article key={item.id} className="rounded-2xl border p-6"><h3 className="text-xl font-semibold">{item.name}</h3><p className="mt-2 text-sm">{item.description}</p>{item.type === "DEPOSIT" && <p className="mt-2 text-sm">Deposit</p>}
      <form action={`${getAppUrl()}/api/payments/checkout`} method="post" className="mt-4 space-y-3"><input type="hidden" name="slug" value={slug} /><input type="hidden" name="itemId" value={item.id} /><input type="hidden" name="requestId" value={randomUUID()} />
        {item.type === "CUSTOM_AMOUNT" ? <label className="block text-sm">Amount (USD)<input className="mt-1 w-full rounded-lg border p-3" name="amount" type="number" step="0.01" min={item.minAmount / 100} max={item.maxAmount / 100} required /><span className="mt-1 block text-xs">{formatMoney(item.minAmount)}–{formatMoney(item.maxAmount)}</span></label> : <p className="text-xl font-semibold">{formatMoney(item.amount)}</p>}
        <button className="rounded-full bg-slate-900 px-5 py-3 font-semibold text-white">Pay securely</button>
      </form></article>)}</div></section>;
}
