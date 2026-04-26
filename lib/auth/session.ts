import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";

export async function getSession() {
  const session = await auth();
  return session;
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}
