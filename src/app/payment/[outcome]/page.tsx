import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { merchantPublicUrl } from "@/lib/payments/service";
export const dynamic = "force-dynamic";
export const metadata = { title: "Payment", robots: { index: false, follow: false } };
export default async function PaymentReturn({ params, searchParams }: { params: Promise<{ outcome: string }>; searchParams: Promise<{ site?: string }> }) {
  const { outcome } = await params;
  if (!["success", "cancel"].includes(outcome)) notFound();
  const { site } = await searchParams;
  const project = site ? await prisma.websiteProject.findFirst({ where: { publicSlug: site, isPublished: true }, include: { domain: true } }) : null;
  return <main className="mx-auto max-w-xl px-6 py-20"><h1 className="text-3xl font-semibold">{outcome === "success" ? "Thank you" : "Checkout closed"}</h1><p className="mt-5">{outcome === "success" ? "Your checkout has returned from Stripe. Payment confirmation can take a moment. The business can provide your receipt once payment is confirmed." : "You can return to the business website whenever you’re ready. Closing checkout does not change an already completed payment."}</p>{project && <Link className="mt-6 inline-block font-semibold underline" href={merchantPublicUrl(project)}>Return to {project.businessName}</Link>}</main>;
}
