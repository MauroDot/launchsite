// Shared upload contract only. Secrets and signature generation stay in the server route.
export type UploadMediaType = "IMAGE" | "VIDEO";

export function uploadPolicy(mediaType: UploadMediaType) {
  return mediaType === "IMAGE"
    ? { allowedFormats: "jpg,png,webp", maxFileSize: 10 * 1024 * 1024, resourceType: "image", mimeTypes: ["image/jpeg", "image/png", "image/webp"] }
    : { allowedFormats: "mp4,mov,webm", maxFileSize: 100 * 1024 * 1024, resourceType: "video", mimeTypes: ["video/mp4", "video/quicktime", "video/webm"] };
}

export function uploadFileError(file: Pick<File, "type" | "size">, mediaType: UploadMediaType) {
  const policy = uploadPolicy(mediaType);
  if (!policy.mimeTypes.includes(file.type) || file.size > policy.maxFileSize) {
    return mediaType === "IMAGE" ? "Choose a JPG, PNG, or WebP image up to 10 MB." : "Choose an MP4, MOV, or WebM video up to 100 MB.";
  }
  return null;
}

export type SignedUpload = {
  cloudName: string; apiKey: string; signature: string;
  timestamp: number; folder: string; allowedFormats: string;
  resourceType: string; maxFileSize: number;
};

/** Cloudinary's supported signed upload fields, in alphabetical order. */
export function cloudinarySignedParams(upload: Pick<SignedUpload, "allowedFormats" | "folder" | "timestamp">) {
  return { allowed_formats: upload.allowedFormats, folder: upload.folder, timestamp: String(upload.timestamp) };
}

export function createCloudinaryUploadForm(file: File, upload: Partial<SignedUpload>, mediaType: UploadMediaType) {
  const fileError = uploadFileError(file, mediaType);
  if (fileError) throw new Error(fileError);
  const policy = uploadPolicy(mediaType);
  if (!upload.cloudName || !upload.apiKey || !upload.signature || !upload.folder || !Number.isInteger(upload.timestamp) || upload.timestamp! <= 0 || upload.allowedFormats !== policy.allowedFormats || upload.resourceType !== policy.resourceType || upload.maxFileSize !== policy.maxFileSize) {
    throw new Error("Could not prepare upload. Refresh the page and try again.");
  }
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", upload.apiKey);
  for (const [key, value] of Object.entries(cloudinarySignedParams(upload as SignedUpload))) form.append(key, value);
  form.append("signature", upload.signature);
  // max_file_size is not a supported direct Upload API parameter. Keep the
  // application size check above; do not add it to either the form or signature.
  return form;
}
