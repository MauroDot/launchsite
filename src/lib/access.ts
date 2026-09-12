import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isBootstrapAdmin } from "@/lib/admin-bootstrap";
import { canAccessProject } from "@/lib/project-ownership";

type AuthUser = { id: string; role: "USER" | "ADMIN" };

export async function requireUser(): Promise<AuthUser> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("UNAUTHENTICATED");

  const user = await (prisma as unknown as { user: { findUnique: (args: unknown) => Promise<AuthUser | null> } }).user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });
  if (!user) throw new Error("UNAUTHENTICATED");
  if (user.role !== "ADMIN" && isBootstrapAdmin(session.user.email)) {
    await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    return { ...user, role: "ADMIN" };
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}

export async function requireProjectAccess(id: string) {
  const user = await requireUser();
  const project = await prisma.websiteProject.findUnique({
    where: { id },
    select: { userId: true, isDemo: true },
  });
  if (!project || !canAccessProject(user, project.userId, project.isDemo)) throw new Error("NOT_FOUND");
  return user;
}
