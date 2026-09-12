"use server";
import { revalidatePath } from "next/cache";
import { addFeaturedBusinessAddon, cancelFeaturedBusinessAddon, selectFeaturedProject } from "@/lib/billing/featured-addon";
export async function addFeaturedBusinessAction() { try { await addFeaturedBusinessAddon(); revalidatePath("/account/billing"); return { ok: true as const }; } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Could not add Featured Business." }; } }
export async function cancelFeaturedBusinessAction() { try { await cancelFeaturedBusinessAddon(); revalidatePath("/account/billing"); return { ok: true as const }; } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Could not cancel Featured Business." }; } }
export async function selectFeaturedProjectAction(projectId: string) { try { await selectFeaturedProject(projectId); revalidatePath("/account/billing"); revalidatePath("/"); return { ok: true as const }; } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Could not select this website." }; } }
