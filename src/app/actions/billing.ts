"use server";

import { createBillingPortal, createCheckout } from "@/lib/billing/checkout";
import { BillingError } from "@/lib/billing/errors";

type BillingResult = { ok: true; url: string } | { ok: false; error: string };

function billingFailure(error: unknown): BillingResult {
  if (error instanceof BillingError) return { ok: false, error: error.message };
  if (error instanceof Error && error.message === "UNAUTHENTICATED") return { ok: false, error: "Please sign in to manage billing." };
  console.error("Billing operation failed", { errorType: error instanceof Error ? error.name : "Unknown" });
  return { ok: false, error: "We couldn't open billing right now. Please try again in a moment." };
}

export async function startCheckoutAction(plan: unknown): Promise<BillingResult> {
  try { return { ok: true, url: await createCheckout(plan) }; }
  catch (error) { return billingFailure(error); }
}

export async function openBillingPortalAction(): Promise<BillingResult> {
  try { return { ok: true, url: await createBillingPortal() }; }
  catch (error) { return billingFailure(error); }
}
