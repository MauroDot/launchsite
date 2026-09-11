import { CreateWizard } from "@/components/create-wizard";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Create your website" };

export default async function CreatePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/create");
  return <CreateWizard />;
}
