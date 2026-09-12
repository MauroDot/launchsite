export function selectLeadNotificationRecipient(project: { email?: string | null; user?: { email?: string | null } | null }) {
  return project.email?.trim() || project.user?.email?.trim() || null;
}
