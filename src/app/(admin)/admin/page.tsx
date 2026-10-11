import { redirect } from "next/navigation";
import { logoutAction } from "@/actions/app";
import { getActor } from "@/lib/auth/current";
import { formatDate } from "@/lib/format";
import { listOrganizationsForPlatformAdmin } from "@/server/org";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!actor.isPlatformAdmin) redirect("/dashboard");
  const orgs = await listOrganizationsForPlatformAdmin(actor);
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Organizations</h1>
          <p className="help">Platform view. Project contents stay inside each agency.</p>
        </div>
        <form action={logoutAction}>
          <input type="hidden" name="csrf" value={actor.csrfToken} />
          <button className="btn-secondary" type="submit">Sign out</button>
        </form>
      </div>
      <ul className="mt-6 space-y-2">
        {orgs.map((org) => (
          <li key={org.id} className="card p-3 text-sm">
            <p className="font-medium">{org.name}</p>
            <p className="text-ink-500">{org.slug} · {org._count.memberships} people · {org._count.clientCompanies} clients · {org._count.projects} projects · since {formatDate(org.createdAt)}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
