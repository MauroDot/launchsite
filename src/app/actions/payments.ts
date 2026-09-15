"use server";
import { revalidatePath } from "next/cache";
import { onboardConnect, recordManualPayment, refreshConnect, saveExternalOption, savePaymentItem, updateManualStatus } from "@/lib/payments/service";
import { changeReceiptAccess, emailReceipt } from "@/lib/payments/receipts";
import { PaymentError } from "@/lib/payments/validation";
import { logOperationalError } from "@/lib/operational-logging";
export type PaymentActionState = { ok: boolean; message: string; url?: string };
export async function paymentAction(projectId: string, operation: string, _previous: PaymentActionState, form: FormData): Promise<PaymentActionState> {
  try {
    const input: Record<string, unknown> = Object.fromEntries(form);
    input.enabled = form.get("enabled") === "on";
    if (operation === "link") { input.sortOrder = Number(form.get("sortOrder")); await saveExternalOption(projectId, input); }
    else if (operation === "item") await savePaymentItem(projectId, input);
    else if (operation === "manual") {
      const descriptions = form.getAll("itemDescription"), quantities = form.getAll("quantity"), amounts = form.getAll("unitAmount");
      input.items = descriptions.map((description, i) => ({ description, quantity: Number(quantities[i]), unitAmount: amounts[i] }));
      const id = await recordManualPayment(projectId, input);
      revalidatePath(`/dashboard/projects/${projectId}/payments`);
      return { ok: true, message: "Payment recorded by your business.", url: `/dashboard/projects/${projectId}/payments/${id}` };
    } else if (operation === "connect") return { ok: true, message: "Opening Stripe…", url: await onboardConnect(projectId) };
    else if (operation === "refresh") await refreshConnect(projectId);
    else if (operation === "email") { await emailReceipt(projectId, String(form.get("paymentId"))); return { ok: true, message: "Receipt email accepted for delivery." }; }
    else if (operation === "access") await changeReceiptAccess(projectId, String(form.get("paymentId")), form.get("enable") === "yes");
    else if (operation === "status") await updateManualStatus(projectId, String(form.get("paymentId")), input);
    else throw new PaymentError("Unknown payment action.");
    revalidatePath(`/dashboard/projects/${projectId}/payments`, "layout");
    return { ok: true, message: "Saved." };
  } catch (error) {
    if (!(error instanceof PaymentError)) logOperationalError({
      category: "STRIPE",
      action: `merchant-${operation}`,
      error,
    });
    return { ok: false, message: error instanceof PaymentError ? error.message : "Unable to complete this request. Check that you’re signed in and try again." };
  }
}
