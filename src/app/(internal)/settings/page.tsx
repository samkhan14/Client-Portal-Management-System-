import { redirect } from "next/navigation";
import { settingsAction } from "@/actions/app";
import { ActionForm } from "@/components/forms";
import { Notice } from "@/components/ui";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/auth/current";
import { canManageOrg } from "@/lib/authz";
import { one } from "@/lib/format";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!canManageOrg(actor.role)) redirect("/dashboard");
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: actor.organizationId } });
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Organization settings</h1>
      <Notice code={one(sp.notice)} />
      <div className="card p-4">
        <ActionForm action={settingsAction} csrf={actor.csrfToken} submitLabel="Save settings">
          <label className="block"><span className="label">Name</span><input className="field" name="name" defaultValue={org.name} required /></label>
          <label className="block"><span className="label">Deadline reminder window (days)</span><input className="field" type="number" min={1} max={30} name="deadlineReminderDays" defaultValue={org.deadlineReminderDays} /></label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="emailNotificationsEnabled" defaultChecked={org.emailNotificationsEnabled} />
            Queue email notification records
          </label>
          <p className="help">Email rows are logged and marked sent. No SMTP provider is called.</p>
        </ActionForm>
      </div>
    </div>
  );
}
