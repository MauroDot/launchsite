"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateProjectContentAction } from "@/app/actions/projects";

export function GenerateContentButton({ projectId, hasGeneratedContent }: { projectId: string; hasGeneratedContent: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "generating" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  async function generate() {
    if (hasGeneratedContent && !window.confirm("Regenerating may replace website copy you have edited. Continue?")) return;
    setState("generating"); setMessage("");
    const result = await generateProjectContentAction(projectId);
    if (!result.ok) { setState("error"); setMessage(result.error); return; }
    setState("success"); setMessage("Website content generated successfully."); router.refresh();
  }
  return <div className="flex flex-col items-start gap-2"><button className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" disabled={state === "generating"} onClick={generate} type="button">{state === "generating" ? "Generating…" : hasGeneratedContent ? "Regenerate website content" : "Generate website content"}</button>{message && <p className={state === "error" ? "text-sm text-rose-700" : "text-sm text-lime-700"}>{message}</p>}</div>;
}
