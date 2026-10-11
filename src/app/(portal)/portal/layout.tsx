import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getActor } from "@/lib/auth/current";
import { isClientRole } from "@/lib/authz";
import { unreadCount } from "@/server/notifications";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!isClientRole(actor.role)) redirect(actor.role === "PLATFORM_ADMIN" ? "/admin" : "/dashboard");
  const unread = await unreadCount(actor.userId, actor.organizationId);
  return (
    <AppShell
      organizationName={actor.organizationName}
      userName={actor.name}
      role={actor.role}
      csrf={actor.csrfToken}
      unread={unread}
      links={[
        { href: "/portal", label: "Home" },
        { href: "/portal/invoices", label: "Invoices" },
        { href: "/portal/notifications", label: "Notifications" },
      ]}
    >
      {children}
    </AppShell>
  );
}
