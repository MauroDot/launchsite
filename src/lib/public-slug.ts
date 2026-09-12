const MAX_PUBLIC_SLUG_LENGTH = 72;

export function normalizePublicSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_PUBLIC_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

export function validatePublicSlug(value: unknown) {
  if (typeof value !== "string" || value.length < 3 || value.length > MAX_PUBLIC_SLUG_LENGTH) return null;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value : null;
}

export function slugCandidate(base: string, attempt: number) {
  if (attempt <= 1) return base;
  const suffix = `-${attempt}`;
  return `${base.slice(0, MAX_PUBLIC_SLUG_LENGTH - suffix.length).replace(/-+$/g, "")}${suffix}`;
}
