import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/current";
import { homeFor } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const actor = await getActor();
  redirect(actor ? homeFor(actor.role) : "/login");
}
