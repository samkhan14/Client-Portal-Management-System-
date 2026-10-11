import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getActor } from "@/lib/auth/current";
import { isClientRole } from "@/lib/authz";
import { unreadCount } from "@/server/notifications";

export const dynamic = "force-dynamic";

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role === "PLATFORM_ADMIN") redirect("/admin");
  if (isClientRole(actor.role)) redirect("/portal");
  const unread = await unreadCount(actor.userId, actor.organizationId);
  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/projects", label: "Projects" },
    { href: "/clients", label: "Clients" },
    { href: "/team", label: "Team" },
    ...(actor.role === "TEAM_MEMBER" ? [] : [{ href: "/invoices", label: "Invoices" }]),
    { href: "/notifications", label: "Notifications" },
    ...(actor.role === "AGENCY_OWNER" ? [{ href: "/settings", label: "Settings" }] : []),
  ];
  return (
    <AppShell
      organizationName={actor.organizationName}
      userName={actor.name}
      role={actor.role}
      csrf={actor.csrfToken}
      unread={unread}
      links={links}
    >
      {children}
    </AppShell>
  );
}
