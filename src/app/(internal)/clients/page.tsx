import Link from "next/link";
import { redirect } from "next/navigation";
import { clientCompanyAction } from "@/actions/app";
import { ActionForm } from "@/components/forms";
import { getActor } from "@/lib/auth/current";
import { canManageAllProjects } from "@/lib/authz";
import { listClientCompanies } from "@/server/org";

export default async function ClientsPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const companies = await listClientCompanies(actor);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Clients</h1>
      <ul className="space-y-2">
        {companies.map((company) => (
          <li key={company.id}>
            <Link className="card block p-3 hover:border-pine-700" href={`/clients/${company.id}`}>
              <p className="font-medium">{company.name}</p>
              {"website" in company && company.website ? <p className="text-sm text-ink-500">{company.website}</p> : null}
            </Link>
          </li>
        ))}
      </ul>
      {canManageAllProjects(actor.role) ? (
        <section className="card p-4">
          <h2 className="font-semibold">Add a client company</h2>
          <ActionForm action={clientCompanyAction} csrf={actor.csrfToken} submitLabel="Create client">
            <label className="block"><span className="label">Name</span><input className="field" name="name" required /></label>
            <label className="block"><span className="label">Website</span><input className="field" name="website" /></label>
            <label className="block"><span className="label">Internal notes</span><textarea className="field" name="notes" rows={2} /></label>
          </ActionForm>
        </section>
      ) : null}
    </div>
  );
}
