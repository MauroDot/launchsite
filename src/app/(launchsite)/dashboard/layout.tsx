import { redirect } from "next/navigation";
import { auth } from "@/auth";
export default async function DashboardLayout({ children }: { children: React.ReactNode }) { if (!(await auth())?.user) redirect("/login?callbackUrl=/dashboard"); return children; }
