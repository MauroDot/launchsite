"use server";

import { createBillingPortal, createCheckout } from "@/lib/billing/checkout";
import { cancelScheduledPlanChange, changeSubscriptionPlan } from "@/lib/billing/plan-changes";
import { BillingError } from "@/lib/billing/errors";

type BillingResult = { ok: true; url: string } | { ok: false; error: string };
type PlanChangeResult = { ok: true; kind: string; effectiveAt?: string } | { ok: false; error: string };

function billingFailure(error: unknown): BillingResult {
  if (error instanceof BillingError) return { ok: false, error: error.message };
  if (error instanceof Error && error.message === "UNAUTHENTICATED") return { ok: false, error: "Please sign in to manage billing." };
  console.error("Billing operation failed", { errorType: error instanceof Error ? error.name : "Unknown" });
  return { ok: false, error: "We couldn't open billing right now. Please try again in a moment." };
}
function billingErrorMessage(error: unknown) {
  const result = billingFailure(error);
  return result.ok ? "We couldn't open billing right now. Please try again in a moment." : result.error;
}

export async function startCheckoutAction(plan: unknown): Promise<BillingResult> {
  try { return { ok: true, url: await createCheckout(plan) }; }
  catch (error) { return billingFailure(error); }
}

export async function openBillingPortalAction(): Promise<BillingResult> {
  try { return { ok: true, url: await createBillingPortal() }; }
  catch (error) { return billingFailure(error); }
}

export async function changePlanAction(target: unknown): Promise<PlanChangeResult> {
  try { const result = await changeSubscriptionPlan(target); return { ok: true, kind: result.kind, effectiveAt: "effectiveAt" in result && result.effectiveAt ? result.effectiveAt.toISOString() : undefined }; }
  catch (error) { return { ok: false, error: billingErrorMessage(error) }; }
}

export async function cancelPlanChangeAction(): Promise<PlanChangeResult> {
  try { const result = await cancelScheduledPlanChange(); return { ok: true, kind: result.kind }; }
  catch (error) { return { ok: false, error: billingErrorMessage(error) }; }
}
