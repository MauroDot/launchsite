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

export function validatePublicSlug(value: string) {
  const normalized = normalizePublicSlug(value);
  if (normalized.length < 3 || normalized.length > MAX_PUBLIC_SLUG_LENGTH) return null;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) ? normalized : null;
}

export function slugCandidate(base: string, attempt: number) {
  if (attempt <= 1) return base;
  const suffix = `-${attempt}`;
  return `${base.slice(0, MAX_PUBLIC_SLUG_LENGTH - suffix.length).replace(/-+$/g, "")}${suffix}`;
}
