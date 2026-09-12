"use server";

import { revalidatePath } from "next/cache";
import { deleteUser, resetUserBilling } from "@/lib/admin-user-management";

type AdminUserActionResult = { ok: true } | { ok: false; error: string };

function failure(error: unknown): AdminUserActionResult {
  return { ok: false, error: error instanceof Error ? error.message : "The administrator action could not be completed." };
}

export async function resetUserBillingAction(targetId: string, confirmationEmail?: string, confirmStripeSubscription = false): Promise<AdminUserActionResult> {
  try { await resetUserBilling(targetId, confirmationEmail, confirmStripeSubscription); revalidatePath("/admin/users"); return { ok: true }; } catch (error) { return failure(error); }
}

export async function deleteUserAction(targetId: string, confirmationEmail: string): Promise<AdminUserActionResult> {
  try { await deleteUser(targetId, confirmationEmail); revalidatePath("/admin/users"); revalidatePath("/admin"); return { ok: true }; } catch (error) { return failure(error); }
}
