"use client";
/* eslint-disable @next/next/no-img-element -- Google profile images are external URLs. */

import Link from "next/link";
import { useState } from "react";
import { changeUserRoleAction } from "@/app/actions/projects";

type AdminUser = { id: string; name: string | null; email: string | null; image: string | null; role: "USER" | "ADMIN"; createdAt: Date; _count: { projects: number } };

export function AdminUsersTable({ users }: { users: AdminUser[] }) {
  const [message, setMessage] = useState("");
  const changeRole = async (id: string, role: "USER" | "ADMIN") => { const result = await changeUserRoleAction(id, role); setMessage(result.ok ? "User role updated." : result.error); };
  return <><div className="overflow-x-auto rounded-2xl border"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-4">User</th><th className="p-4">Role</th><th className="p-4">Projects</th><th className="p-4">Joined</th><th className="p-4">Action</th></tr></thead><tbody>{users.map((user) => <tr className="border-t" key={user.id}><td className="p-4"><div className="flex items-center gap-3">{user.image ? <img alt="" className="size-8 rounded-full" src={user.image} /> : <span className="grid size-8 place-items-center rounded-full bg-slate-100 text-xs">{user.name?.[0] ?? "?"}</span>}<div><p className="font-semibold">{user.name ?? "Unnamed user"}</p><p className="text-slate-500">{user.email ?? "No email"}</p></div></div></td><td className="p-4">{user.role}</td><td className="p-4"><Link className="font-semibold underline" href={`/admin/users/${user.id}`}>{user._count.projects}</Link></td><td className="p-4">{new Date(user.createdAt).toLocaleDateString()}</td><td className="p-4"><button className="font-semibold text-slate-900" onClick={() => changeRole(user.id, user.role === "ADMIN" ? "USER" : "ADMIN")} type="button">Make {user.role === "ADMIN" ? "user" : "admin"}</button></td></tr>)}</tbody></table></div>{message && <p className="mt-4 text-sm" role="status">{message}</p>}</>;
}
