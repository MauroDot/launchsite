"use client";

import { useState } from "react";
import Image from "next/image";
import { updateProjectSeoAction } from "@/app/actions/seo";

type Settings = { seoTitle: string; seoDescription: string; socialImageUrl: string; allowIndexing: boolean };
type SignedUpload = { error?: string; cloudName?: string; apiKey?: string; timestamp?: number; folder?: string; signature?: string; resourceType?: string };
type UploadedImage = { secure_url?: string; public_id?: string; width?: number; height?: number; format?: string; error?: { message?: string } };
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function SeoSettingsForm({ projectId, initial }: { projectId: string; initial: { seoTitle?: string; seoDescription?: string; socialImageUrl?: string; allowIndexing: boolean } }) {
  const [settings, setSettings] = useState<Settings>({ seoTitle: initial.seoTitle ?? "", seoDescription: initial.seoDescription ?? "", socialImageUrl: initial.socialImageUrl ?? "", allowIndexing: initial.allowIndexing });
  const [imageDetails, setImageDetails] = useState<UploadedImage | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const update = (changes: Partial<Settings>) => setSettings((current) => ({ ...current, ...changes }));

  const uploadSocialImage = async (file?: File) => {
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) { setMessage("Choose a JPG, PNG, or WebP image up to 10 MB."); return; }
    setUploading(true); setMessage("");
    try {
      // This is the existing authenticated signed Cloudinary upload flow used by work samples.
      const signedResponse = await fetch(`/api/projects/${projectId}/work-samples/upload-signature`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaType: "IMAGE" }) });
      const signed = await signedResponse.json() as SignedUpload;
      if (!signedResponse.ok || !signed.cloudName || !signed.apiKey || !signed.timestamp || !signed.folder || !signed.signature || !signed.resourceType) throw new Error(signed.error ?? "Could not prepare upload.");
      const form = new FormData(); form.append("file", file); form.append("api_key", signed.apiKey); form.append("timestamp", String(signed.timestamp)); form.append("folder", signed.folder); form.append("signature", signed.signature);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/${signed.resourceType}/upload`, { method: "POST", body: form });
      const asset = await response.json() as UploadedImage;
      if (!response.ok || !asset.secure_url || !asset.public_id) throw new Error(asset.error?.message ?? "Upload failed.");
      update({ socialImageUrl: asset.secure_url }); setImageDetails(asset); setMessage("Image uploaded. Save SEO settings to use it.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); } finally { setUploading(false); }
  };

  const save = async () => { setSaving(true); const result = await updateProjectSeoAction(projectId, settings); setSaving(false); setMessage(result.ok ? "SEO settings saved." : result.error); };
  return <section className="mt-8 rounded-2xl border border-slate-200 p-6" id="seo-settings">
    <h2 className="text-xl font-semibold">SEO and social sharing</h2><p className="mt-2 text-sm text-slate-600">Search engines may take time to update changes.</p>
    <div className="mt-5 grid gap-4">
      <label className="text-sm font-semibold">Search title <span className="font-normal text-slate-500">(recommended 50–60 characters)</span><input className="mt-1 w-full rounded border p-3" maxLength={300} value={settings.seoTitle} onChange={(event) => update({ seoTitle: event.target.value })} /></label>
      <label className="text-sm font-semibold">Search description <span className="font-normal text-slate-500">(recommended 140–160 characters)</span><textarea className="mt-1 w-full rounded border p-3" maxLength={1000} rows={4} value={settings.seoDescription} onChange={(event) => update({ seoDescription: event.target.value })} /></label>
      <div><p className="text-sm font-semibold">Social preview image <span className="font-normal text-slate-500">(optional)</span></p><p className="mt-1 text-xs text-slate-500">Use JPG, PNG, or WebP, ideally 1200 × 630 pixels and no larger than 10 MB.</p>
        {settings.socialImageUrl ? <div className="mt-3 flex flex-wrap items-start gap-4"><Image alt="Selected social preview" className="h-32 w-56 rounded-lg border object-cover" height={128} src={settings.socialImageUrl} unoptimized width={224} />{imageDetails?.width && imageDetails.height && <p className="text-xs text-slate-500">{imageDetails.width} × {imageDetails.height} · {imageDetails.format?.toUpperCase()}</p>}<button className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={() => { update({ socialImageUrl: "" }); setImageDetails(null); setMessage("Social preview image removed. Save SEO settings to use the fallback image."); }} type="button">Remove image</button></div> : <p className="mt-3 text-sm text-slate-600">No dedicated image selected. The first image work sample will be used when available.</p>}
        <label className="mt-3 inline-block cursor-pointer rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold"><input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(event) => { void uploadSocialImage(event.target.files?.[0]); event.currentTarget.value = ""; }} type="file" />{uploading ? "Uploading…" : settings.socialImageUrl ? "Replace image" : "Upload social preview image"}</label>
      </div>
      <label className="flex gap-3 text-sm"><input checked={settings.allowIndexing} onChange={(event) => update({ allowIndexing: event.target.checked })} type="checkbox" />Allow search engines to index this site</label>
      <div className="rounded-xl bg-slate-50 p-4"><p className="font-semibold">{settings.seoTitle || "Your business name"}</p><p className="mt-1 text-sm text-blue-700">Your preferred public URL</p><p className="mt-2 text-sm text-slate-600">{settings.seoDescription || "Your search description will appear here."}</p></div>
    </div>
    <button className="mt-5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white" disabled={saving || uploading} onClick={() => { void save(); }} type="button">{saving ? "Saving…" : "Save SEO settings"}</button>{message && <p className="mt-3 text-sm" role="status">{message}</p>}
  </section>;
}
