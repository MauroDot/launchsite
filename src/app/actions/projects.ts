"use server";

import { revalidatePath } from "next/cache";
import { createProject, updateProject } from "@/lib/project-repository";
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
