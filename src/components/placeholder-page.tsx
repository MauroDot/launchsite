import Link from "next/link";

type PlaceholderPageProps = { eyebrow: string; title: string; description: string; actionLabel: string; actionHref: string };

export function PlaceholderPage({ eyebrow, title, description, actionLabel, actionHref }: PlaceholderPageProps) {
  return <section className="mx-auto flex min-h-[60vh] max-w-3xl items-center px-5 py-16 sm:px-8"><div><p className="eyebrow">{eyebrow}</p><h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-5xl">{title}</h1><p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">{description}</p><Link className="mt-8 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white" href={actionHref}>{actionLabel}</Link></div></section>;
}
