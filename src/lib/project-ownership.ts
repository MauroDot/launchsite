export type ProjectOwner = {
  id: string;
  role: "USER" | "ADMIN";
};

/** Keeps the tenant boundary decision independent of database and Auth.js details. */
export function canAccessProject(user: ProjectOwner, projectUserId: string | null, isDemo = false) {
  return projectUserId === user.id || (user.role === "ADMIN" && isDemo);
}
