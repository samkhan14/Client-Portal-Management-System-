import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/forms";
import { Badge, Notice } from "@/components/ui";
import {
  changeStatusAction,
  changeRequestAction,
  createMilestoneAction,
  decideChangeAction,
  updateProjectAction,
  addMemberAction,
  removeMemberAction,
} from "@/actions/app";
import { getActor } from "@/lib/auth/current";
import { canManageAllProjects, canSeeInternalFinancials } from "@/lib/authz";
import { PRIORITY_LABEL, PROJECT_STATUS_EXPLAIN, PROJECT_STATUS_LABEL, PROJECT_TRANSITIONS } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { dateInput, formatDate, formatMoney, one } from "@/lib/format";
import { listChangeRequests } from "@/server/finance";
import { listMemberships } from "@/server/org";
import { presentProject, requireProject } from "@/server/projects";
import { listMilestones } from "@/server/tasks";

export default async function ProjectOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const { projectId } = await params;
  const sp = await searchParams;
  const project = await requireProject(actor, projectId).catch((error: unknown) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  const view = presentProject(project, actor);
  const [milestones, changes, people] = await Promise.all([
    listMilestones(actor, project.id),
    listChangeRequests(actor, project.id),
    canManageAllProjects(actor.role) ? listMemberships(actor) : Promise.resolve([]),
  ]);
  const manager = canManageAllProjects(actor.role);
  const finance = canSeeInternalFinancials(actor.role);
  return (
    <div className="space-y-6">
      <Notice code={one(sp.notice)} />
      <section className="card p-4">
        <h2 className="font-semibold">Status</h2>
        <p className="mt-1 text-sm text-ink-600">{PROJECT_STATUS_EXPLAIN[project.status]}</p>
        {project.outstandingRequest ? (
          <p className="mt-3 rounded-md bg-clay-50 px-3 py-2 text-sm text-clay-700">Outstanding request: {project.outstandingRequest}</p>
        ) : null}
        {project.description ? <p className="mt-3 whitespace-pre-wrap text-sm">{project.description}</p> : null}
        {project.scope ? <p className="mt-2 whitespace-pre-wrap text-sm text-ink-600">Scope: {project.scope}</p> : null}
        {view.internalNotes ? <p className="mt-2 whitespace-pre-wrap text-sm text-ink-600">Internal notes: {view.internalNotes}</p> : null}
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-500">Agreed fee</dt><dd>{formatMoney(view.agreedFee)}{project.agreedFeeClientVisible ? " · visible to client" : ""}</dd></div>
          {finance ? <div><dt className="text-ink-500">Internal estimate</dt><dd>{formatMoney(view.internalEstimate)}</dd></div> : null}
        </dl>
      </section>
      {manager ? (
        <section className="card p-4">
          <h2 className="font-semibold">Change status</h2>
          <ActionForm action={changeStatusAction} csrf={actor.csrfToken} submitLabel="Update status" hidden={{ projectId: project.id, returnTo: `/projects/${project.id}` }}>
            <label className="block">
              <span className="label">Next status</span>
              <select className="field" name="status" defaultValue={project.status}>
                <option value={project.status}>{PROJECT_STATUS_LABEL[project.status]} (current)</option>
                {PROJECT_TRANSITIONS[project.status].map((status) => (
                  <option key={status} value={status}>{PROJECT_STATUS_LABEL[status]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Outstanding request</span>
              <textarea className="field" name="outstandingRequest" rows={2} defaultValue={project.outstandingRequest ?? ""} placeholder="Required when waiting on the client" />
            </label>
          </ActionForm>
        </section>
      ) : null}
      <section className="space-y-3">
        <h2 className="font-semibold">Milestones</h2>
        {milestones.length === 0 ? <p className="help">No milestones yet. Progress stays at 0% until one is complete.</p> : null}
        <ul className="space-y-2">
          {milestones.map((milestone) => (
            <li key={milestone.id} className="card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{milestone.title}</p>
                <Badge value={milestone.complete ? "DONE" : "IN_PROGRESS"} label={milestone.complete ? "Complete" : "Not complete"} />
              </div>
              <p className="text-sm text-ink-500">Due {formatDate(milestone.dueDate)} · {milestone.doneCount}/{milestone.taskCount} tasks done</p>
            </li>
          ))}
        </ul>
        {manager ? (
          <div className="card p-4">
            <h3 className="font-medium">Add milestone</h3>
            <ActionForm action={createMilestoneAction} csrf={actor.csrfToken} submitLabel="Add milestone" hidden={{ projectId: project.id, returnTo: `/projects/${project.id}` }}>
              <label className="block"><span className="label">Title</span><input className="field" name="title" required /></label>
              <label className="block"><span className="label">Due</span><input className="field" type="date" name="dueDate" /></label>
            </ActionForm>
          </div>
        ) : null}
      </section>
      <section className="card p-4">
        <h2 className="font-semibold">People</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {project.members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-2">
              <span>{member.user.name} · {member.role.replaceAll("_", " ").toLowerCase()}</span>
              {manager ? (
                <ActionForm action={removeMemberAction} csrf={actor.csrfToken} submitLabel="Remove" hidden={{ projectId: project.id, userId: member.userId }}>
                  <span className="sr-only">Remove {member.user.name}</span>
                </ActionForm>
              ) : null}
            </li>
          ))}
        </ul>
        {manager ? (
          <ActionForm action={addMemberAction} csrf={actor.csrfToken} submitLabel="Add to project" hidden={{ projectId: project.id }}>
            <label className="block">
              <span className="label">Organization member</span>
              <select className="field" name="userId" required defaultValue="">
                <option value="" disabled>Choose a person</option>
                {people.map((person) => <option key={person.userId} value={person.userId}>{person.user.name}</option>)}
              </select>
            </label>
          </ActionForm>
        ) : null}
      </section>
      {finance ? (
        <section className="card p-4">
          <h2 className="font-semibold">Change requests</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {changes.length === 0 ? <li className="help">None yet.</li> : null}
            {changes.map((change) => (
              <li key={change.id} className="rounded-md border border-line p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{change.title} · {formatMoney(change.amount)}</span>
                  <Badge value={change.status} label={change.status.toLowerCase()} />
                </div>
                <p className="text-ink-500">{change.clientVisible ? "Visible to the client" : "Internal"}</p>
                {change.status === "REQUESTED" ? (
                  <div className="mt-2 flex gap-2">
                    <ActionForm action={decideChangeAction} csrf={actor.csrfToken} submitLabel="Approve" hidden={{ changeRequestId: change.id, status: "APPROVED", returnTo: `/projects/${project.id}` }}><span className="sr-only">Approve {change.title}</span></ActionForm>
                    <ActionForm action={decideChangeAction} csrf={actor.csrfToken} submitLabel="Reject" hidden={{ changeRequestId: change.id, status: "REJECTED", returnTo: `/projects/${project.id}` }}><span className="sr-only">Reject {change.title}</span></ActionForm>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <ActionForm action={changeRequestAction} csrf={actor.csrfToken} submitLabel="Add change request" hidden={{ projectId: project.id, returnTo: `/projects/${project.id}` }}>
              <label className="block"><span className="label">Title</span><input className="field" name="title" required /></label>
              <label className="block"><span className="label">Amount</span><input className="field" name="amount" required inputMode="decimal" /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="clientVisible" /> Visible to the client</label>
            </ActionForm>
          </div>
        </section>
      ) : null}
      {manager ? (
        <section className="card p-4">
          <h2 className="font-semibold">Edit details</h2>
          <ActionForm action={updateProjectAction} csrf={actor.csrfToken} submitLabel="Save project" hidden={{ projectId: project.id, returnTo: `/projects/${project.id}` }}>
            <label className="block"><span className="label">Name</span><input className="field" name="name" defaultValue={project.name} required /></label>
            <label className="block"><span className="label">Description</span><textarea className="field" name="description" rows={3} defaultValue={project.description ?? ""} /></label>
            <label className="block"><span className="label">Scope</span><textarea className="field" name="scope" rows={3} defaultValue={project.scope ?? ""} /></label>
            <label className="block"><span className="label">Internal notes</span><textarea className="field" name="internalNotes" rows={2} defaultValue={view.internalNotes ?? ""} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="label">Start</span><input className="field" type="date" name="startDate" defaultValue={dateInput(project.startDate)} /></label>
              <label className="block"><span className="label">Due</span><input className="field" type="date" name="dueDate" defaultValue={dateInput(project.dueDate)} /></label>
            </div>
            <label className="block">
              <span className="label">Priority</span>
              <select className="field" name="priority" defaultValue={project.priority}>
                {Object.entries(PRIORITY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {finance ? (
              <>
                <label className="block"><span className="label">Agreed fee</span><input className="field" name="agreedFee" defaultValue={view.agreedFee?.toString() ?? ""} /></label>
                <label className="block"><span className="label">Internal estimate</span><input className="field" name="internalEstimate" defaultValue={view.internalEstimate?.toString() ?? ""} /></label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="agreedFeeClientVisible" defaultChecked={project.agreedFeeClientVisible} /> Show the agreed fee to the client</label>
              </>
            ) : null}
          </ActionForm>
        </section>
      ) : null}
    </div>
  );
}
