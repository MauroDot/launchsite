"use server";

import { revalidatePath } from "next/cache";
import { createProject, updateProject } from "@/lib/project-repository";
import { getProject, saveGeneratedContent } from "@/lib/project-repository";
import { generateWebsiteContent } from "@/lib/openai-content-generator";
import type { WebsiteProjectInput } from "@/lib/website-types";

type ActionResult = { ok: true; id: string } | { ok: false; error: string };

function errorMessage(error: unknown) {
  console.error("Website project database operation failed", error);
  return "We couldn’t save your project right now. Please check your connection and try again.";
}

export async function saveProjectAction(input: WebsiteProjectInput, id?: string): Promise<ActionResult> {
  try {
    const project = id ? await updateProject(id, input) : await createProject(input);
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/projects/${project.id}`);
    return { ok: true, id: project.id };
  } catch (error) {
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
    return { ok: true, id };
  } catch (error) {
    console.error("Website content generation failed", { projectId: id, error });
    return { ok: false, error: "We couldn’t generate content right now. Your existing website content is unchanged." };
  } finally {
    activeGenerations.delete(id);
  }
}
