export function isBootstrapAdmin(email: string | null | undefined, allowlist = process.env.ADMIN_EMAILS) {
  if (!email || !allowlist) return false;
  const normalized = email.trim().toLowerCase();
  return allowlist.split(",").some((allowed) => allowed.trim().toLowerCase() === normalized);
}
