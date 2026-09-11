import Link from "next/link";
import { AdminUsersTable } from "@/components/admin-users-table";
import { listAdminUsers } from "@/lib/project-repository";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await listAdminUsers();
  return <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8"><Link className="text-sm font-semibold text-slate-600" href="/admin">Back to admin</Link><p className="mt-6 eyebrow">Users</p><h1 className="mt-4 text-4xl font-semibold">Accounts</h1><p className="mt-2 text-slate-600">Only safe profile information and project counts are shown.</p><div className="mt-8"><AdminUsersTable users={users} /></div></section>;
}
