import { notFound, redirect } from "next/navigation";
import { onboardingAction, changeRequestAction } from "@/actions/app";
import { ActionForm } from "@/components/forms";
import { Badge } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { AppError } from "@/lib/errors";
import { formatDate, formatMoney } from "@/lib/format";
import { listChangeRequests } from "@/server/finance";
import { getClientCompany } from "@/server/org";
import { presentProject, requireProject } from "@/server/projects";
import { listMilestones } from "@/server/tasks";

export default async function PortalOverviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const { projectId } = await params;
  const project = await requireProject(actor, projectId).catch((error: unknown) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  const view = presentProject(project, actor);
  const [milestones, changes, company] = await Promise.all([
    listMilestones(actor, project.id),
    listChangeRequests(actor, project.id),
    actor.clientCompanyId ? getClientCompany(actor, actor.clientCompanyId) : Promise.resolve(null),
  ]);
  const back = `/portal/projects/${project.id}`;
  return (
    <div className="space-y-6">
      {project.status === "WAITING_ON_CLIENT" && project.outstandingRequest ? (
        <section className="rounded-xl border border-clay-600/20 bg-clay-50 p-4">
          <h2 className="font-semibold text-clay-700">What we need from you</h2>
          <p className="mt-1 text-sm">{project.outstandingRequest}</p>
        </section>
      ) : null}
      {project.description ? <p className="whitespace-pre-wrap text-sm">{project.description}</p> : null}
      {project.scope ? <p className="whitespace-pre-wrap text-sm text-ink-600">Scope: {project.scope}</p> : null}
      {view.agreedFee ? <p className="text-sm">Agreed fee {formatMoney(view.agreedFee)}</p> : null}
      <section>
        <h2 className="font-semibold">Milestones</h2>
        <ul className="mt-2 space-y-2">
          {milestones.map((milestone) => (
            <li key={milestone.id} className="card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{milestone.title}</p>
                <Badge value={milestone.complete ? "DONE" : "IN_PROGRESS"} label={milestone.complete ? "Complete" : "In progress"} />
              </div>
              <p className="text-sm text-ink-500">Due {formatDate(milestone.dueDate)} · {milestone.doneCount} of {milestone.taskCount} shared tasks done</p>
            </li>
          ))}
        </ul>
      </section>
      {company && "steps" in company ? (
        <section className="card p-4">
          <h2 className="font-semibold">Getting started</h2>
          <ul className="mt-2 space-y-2">
            {company.steps.map((step) => (
              <li key={step.id} className="text-sm">
                <p className="font-medium">{step.completedAt ? "Done" : "Open"} · {step.title}</p>
                {step.description ? <p className="text-ink-500">{step.description}</p> : null}
                {actor.role === "CLIENT_ADMIN" ? (
                  <ActionForm action={onboardingAction} csrf={actor.csrfToken} submitLabel={step.completedAt ? "Mark open" : "Mark done"} hidden={{ stepId: step.id, returnTo: back, ...(step.completedAt ? {} : { completed: "on" }) }}>
                    <span className="sr-only">{step.title}</span>
                  </ActionForm>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="card p-4">
        <h2 className="font-semibold">Change requests</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {changes.map((change) => (
            <li key={change.id}>{change.title} · {formatMoney(change.amount)} · {change.status.toLowerCase()}</li>
          ))}
          {changes.length === 0 ? <li className="help">No shared change requests.</li> : null}
        </ul>
        {actor.role === "CLIENT_ADMIN" ? (
          <div className="mt-3">
            <ActionForm action={changeRequestAction} csrf={actor.csrfToken} submitLabel="Request a change" hidden={{ projectId: project.id, returnTo: back }}>
              <label className="block"><span className="label">Title</span><input className="field" name="title" required /></label>
              <label className="block"><span className="label">Amount</span><input className="field" name="amount" required /></label>
            </ActionForm>
          </div>
        ) : null}
      </section>
    </div>
  );
}
