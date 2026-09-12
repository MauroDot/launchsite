"use server";
import { revalidatePath } from "next/cache";
import { updateUserLeadStatus } from "@/lib/leads/service";
export async function updateLeadStatusAction(id: string, status: string) { try { await updateUserLeadStatus(id, status); revalidatePath("/dashboard/leads"); revalidatePath(`/dashboard/leads/${id}`); return { ok: true as const }; } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Unable to update lead." }; } }
