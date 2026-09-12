"use server";
import { revalidatePath } from "next/cache";
import { updateProjectSeo, type SeoSettingsInput } from "@/lib/seo-settings";
export async function updateProjectSeoAction(projectId: string, input: SeoSettingsInput) { try { await updateProjectSeo(projectId, input); revalidatePath(`/dashboard/projects/${projectId}`); revalidatePath(`/dashboard/projects/${projectId}/edit-site`); revalidatePath("/site/[slug]"); revalidatePath("/custom-domain/[hostname]"); return { ok: true as const }; } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Could not save SEO settings." }; } }
