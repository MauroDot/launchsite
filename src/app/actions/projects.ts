"use server";

import { revalidatePath } from "next/cache";
import { createAdminProject, createProject, publishProject, unpublishProject, updateProject } from "@/lib/project-repository";
import { changeUserRole, getProject, saveDemoSettings, saveFeaturedBusiness, saveGeneratedContent, saveSiteContent } from "@/lib/project-repository";
import { generateWebsiteContent } from "@/lib/openai-content-generator";
import { ProjectInputValidationError } from "@/lib/project-validation";
import type { DemoSettings, SiteSettings, StructuredWebsiteContent, WebsiteProjectInput } from "@/lib/website-types";
import type { FeaturedBusinessInput } from "@/lib/project-repository";

type ActionResult = { ok: true; id: string; publicSlug?: string } | { ok: false; error: string; workSampleErrors?: Record<string, string> };

function errorMessage(error: unknown) {
  console.error("Website project database operation failed", error);
  return "We couldn’t save your project right now. Please check your connection and try again.";
}

export async function saveProjectAction(input: WebsiteProjectInput, id?: string): Promise<ActionResult> {
  try {
    const project = id ? await updateProject(id, input) : await createProject(input);
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/projects/${project.id}`);
    revalidatePath("/site/[slug]", "page");
    return { ok: true, id: project.id };
  } catch (error) {
    if (error instanceof ProjectInputValidationError) {
      return { ok: false, error: error.message, workSampleErrors: error.workSampleErrors };
    }
    return { ok: false, error: errorMessage(error) };
  }
}

export async function createAdminProjectAction(input: WebsiteProjectInput, isDemo: boolean): Promise<ActionResult> {
  try {
    const project = await createAdminProject(input, isDemo);
    revalidatePath("/admin");
    revalidatePath("/admin/projects");
    return { ok: true, id: project.id };
  } catch (error) {
    if (error instanceof ProjectInputValidationError) return { ok: false, error: error.message, workSampleErrors: error.workSampleErrors };
    return { ok: false, error: errorMessage(error) };
  }
}

const activeGenerations = new Set<string>();

export async function generateProjectContentAction(id: string): Promise<ActionResult> {
  if (activeGenerations.has(id)) return { ok: false, error: "Content generation is already in progress." };
  activeGenerations.add(id);
  try {
    const project = await getProject(id);
    if (!project) return { ok: false, error: "This project could not be found." };
    const content = await generateWebsiteContent(project);
    await saveGeneratedContent(id, content);
    revalidatePath(`/dashboard/projects/${id}`);
    revalidatePath("/site/[slug]", "page");
    return { ok: true, id };
  } catch (error) {
    console.error("Website content generation failed", { projectId: id, error });
    return { ok: false, error: "We couldn’t generate content right now. Your existing website content is unchanged." };
  } finally {
    activeGenerations.delete(id);
  }
}

export async function saveSiteContentAction(id: string, content: StructuredWebsiteContent, settings: SiteSettings): Promise<ActionResult> {
  try {
    await saveSiteContent(id, content, settings);
    revalidatePath(`/dashboard/projects/${id}`);
    revalidatePath(`/dashboard/projects/${id}/preview`);
    revalidatePath(`/dashboard/projects/${id}/edit-site`);
    revalidatePath(`/site/[slug]`, "page");
    return { ok: true, id };
  } catch (error) {
    console.error("Website content save failed", { projectId: id, error });
    return { ok: false, error: "We couldn't save your website edits. Your business facts were not changed." };
  }
}

export async function publishProjectAction(id: string, requestedSlug?: string): Promise<ActionResult> {
  try {
    const project = await publishProject(id, requestedSlug);
    revalidatePath("/");
    revalidatePath(`/dashboard/projects/${id}`);
    revalidatePath(`/site/${project.publicSlug}`);
    return { ok: true, id, publicSlug: project.publicSlug };
  } catch (error) {
    return { ok: false, error: error instanceof ProjectInputValidationError ? error.message : "We couldn’t publish this website right now. Please try again." };
  }
}

export async function unpublishProjectAction(id: string): Promise<ActionResult> {
  try {
    const project = await unpublishProject(id);
    revalidatePath("/");
    revalidatePath(`/dashboard/projects/${id}`);
    if (project.publicSlug) revalidatePath(`/site/${project.publicSlug}`);
    return { ok: true, id, publicSlug: project.publicSlug };
  } catch {
    return { ok: false, error: "We couldn’t unpublish this website right now. Please try again." };
  }
}

export async function saveDemoSettingsAction(id: string, settings: DemoSettings): Promise<ActionResult> { try { await saveDemoSettings(id, settings); revalidatePath("/dashboard"); revalidatePath(`/dashboard/projects/${id}`); revalidatePath("/examples"); return { ok: true, id }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not save example settings." }; } }

export async function saveFeaturedBusinessAction(id: string, settings: FeaturedBusinessInput): Promise<ActionResult> { try { await saveFeaturedBusiness(id, settings); revalidatePath("/admin"); revalidatePath("/admin/projects"); revalidatePath(`/dashboard/projects/${id}`); revalidatePath("/"); return { ok: true, id }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not save featured business settings." }; } }

export async function changeUserRoleAction(id: string, role: "USER" | "ADMIN"): Promise<ActionResult> { try { await changeUserRole(id, role); revalidatePath("/admin/users"); return { ok: true, id }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not change user role." }; } }
