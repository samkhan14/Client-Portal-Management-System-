import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { onboardingAction } from "@/actions/app";
import { ActionForm } from "@/components/forms";
import { Notice } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { canManageAllProjects } from "@/lib/authz";
import { ROLE_LABEL, PROJECT_STATUS_LABEL } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { one } from "@/lib/format";
import { getClientCompany } from "@/server/org";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const { clientId } = await params;
  const sp = await searchParams;
  const company = await getClientCompany(actor, clientId).catch((error: unknown) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  const manager = canManageAllProjects(actor.role);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-ink-500"><Link href="/clients" className="hover:underline">Clients</Link></p>
        <h1 className="text-2xl font-semibold">{company.name}</h1>
        {company.website ? <p className="text-sm text-ink-500">{company.website}</p> : null}
        {company.notes ? <p className="mt-2 text-sm text-ink-700">Internal notes: {company.notes}</p> : null}
      </div>
      <Notice code={one(sp.notice)} />
      <section>
        <h2 className="font-semibold">Onboarding</h2>
        <ul className="mt-2 space-y-2">
          {company.steps.map((step) => (
            <li key={step.id} className="card p-3 text-sm">
              <p className="font-medium">{step.completedAt ? "Complete" : "Open"} · {step.title}</p>
              {step.description ? <p className="text-ink-500">{step.description}</p> : null}
              {manager ? (
                <ActionForm action={onboardingAction} csrf={actor.csrfToken} submitLabel={step.completedAt ? "Reopen" : "Complete"} hidden={{ stepId: step.id, returnTo: `/clients/${company.id}`, ...(step.completedAt ? {} : { completed: "on" }) }}>
                  <span className="sr-only">{step.title}</span>
                </ActionForm>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-semibold">Contacts</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {company.memberships.map((membership) => (
            <li key={membership.id}>{membership.user.name} · {membership.user.email} · {ROLE_LABEL[membership.role]}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-semibold">Projects</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {company.projects.map((project) => (
            <li key={project.id}><Link className="text-pine-800 underline" href={`/projects/${project.id}`}>{project.reference} · {project.name}</Link> · {PROJECT_STATUS_LABEL[project.status]}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
