import { redirect } from "next/navigation";
import { ActionForm } from "@/components/forms";
import { createProjectAction } from "@/actions/app";
import { getActor } from "@/lib/auth/current";
import { canManageAllProjects } from "@/lib/authz";
import { PRIORITY_LABEL } from "@/lib/constants";
import { listClientCompanies, listMemberships } from "@/server/org";

export default async function NewProjectPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!canManageAllProjects(actor.role)) redirect("/projects");
  const [companies, people] = await Promise.all([listClientCompanies(actor), listMemberships(actor)]);
  const managers = people.filter((person) => person.role === "AGENCY_OWNER" || person.role === "PROJECT_MANAGER");
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">New project</h1>
      <div className="card p-5">
        <ActionForm action={createProjectAction} csrf={actor.csrfToken} submitLabel="Create project" pendingLabel="Creating…">
          <label className="block"><span className="label">Name</span><input className="field" name="name" required /></label>
          <label className="block"><span className="label">Reference</span><input className="field" name="reference" required placeholder="WEB-104" /></label>
          <label className="block">
            <span className="label">Client company</span>
            <select className="field" name="clientCompanyId" required defaultValue="">
              <option value="" disabled>Choose a client</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Project manager</span>
            <select className="field" name="projectManagerId" required defaultValue={actor.userId}>
              {managers.map((person) => <option key={person.userId} value={person.userId}>{person.user.name}</option>)}
            </select>
          </label>
          <fieldset>
            <legend className="label">Team and client members</legend>
            <div className="space-y-1">
              {people.map((person) => (
                <label key={person.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="memberIds" value={person.userId} />
                  {person.user.name} · {person.user.email}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block"><span className="label">Description</span><textarea className="field" name="description" rows={3} /></label>
          <label className="block"><span className="label">Scope</span><textarea className="field" name="scope" rows={3} /></label>
          <label className="block"><span className="label">Internal notes</span><textarea className="field" name="internalNotes" rows={2} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="label">Start</span><input className="field" type="date" name="startDate" /></label>
            <label className="block"><span className="label">Due</span><input className="field" type="date" name="dueDate" /></label>
          </div>
          <label className="block">
            <span className="label">Priority</span>
            <select className="field" name="priority" defaultValue="MEDIUM">
              {Object.entries(PRIORITY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="label">Agreed fee</span><input className="field" name="agreedFee" inputMode="decimal" /></label>
            <label className="block"><span className="label">Internal estimate</span><input className="field" name="internalEstimate" inputMode="decimal" /></label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="agreedFeeClientVisible" /> Show the agreed fee to the client
          </label>
        </ActionForm>
      </div>
    </div>
  );
}
