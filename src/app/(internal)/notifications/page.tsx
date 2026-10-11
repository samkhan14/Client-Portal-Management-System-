import { redirect } from "next/navigation";
import { NotificationsView } from "@/components/notifications";
import { getActor } from "@/lib/auth/current";
import { listNotifications } from "@/server/notifications";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const sp = await searchParams;
  const items = await listNotifications(actor.userId, actor.organizationId);
  return (
    <NotificationsView
      items={items}
      csrf={actor.csrfToken}
      notice={typeof sp.notice === "string" ? sp.notice : undefined}
      returnTo="/notifications"
      canScan={actor.role === "AGENCY_OWNER" || actor.role === "PROJECT_MANAGER"}
    />
  );
}
