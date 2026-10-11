import { redirect } from "next/navigation";
import { inviteAction, revokeInviteAction, revokeMemberAction } from "@/actions/app";
import { ActionForm } from "@/components/forms";
import { Notice } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { canManageAllProjects } from "@/lib/authz";
import { ROLE_LABEL } from "@/lib/constants";
import { formatDate, one } from "@/lib/format";
import { listClientCompanies, listInvitations, listMemberships } from "@/server/org";
import { listProjects } from "@/server/projects";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const sp = await searchParams;
  const manager = canManageAllProjects(actor.role);
  const [people, companies, projects] = await Promise.all([
    listMemberships(actor),
    manager ? listClientCompanies(actor) : Promise.resolve([]),
    manager ? listProjects(actor, { page: 1, pageSize: 100 }) : Promise.resolve({ items: [], total: 0 }),
  ]);
  const invites = manager ? await listInvitations(actor) : [];
  const roles = actor.role === "AGENCY_OWNER"
    ? ["AGENCY_OWNER", "PROJECT_MANAGER", "TEAM_MEMBER", "CLIENT_ADMIN", "CLIENT_COLLABORATOR", "READ_ONLY"]
    : ["PROJECT_MANAGER", "TEAM_MEMBER", "CLIENT_ADMIN", "CLIENT_COLLABORATOR", "READ_ONLY"];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="help">People with access to {actor.organizationName}. Removing someone blocks them immediately.</p>
      </div>
      <Notice code={one(sp.notice)} />
      <ul className="space-y-2">
        {people.map((person) => (
          <li key={person.id} className="card flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
            <div>
              <p className="font-medium">{person.user.name}</p>
              <p className="text-ink-500">{person.user.email} · {ROLE_LABEL[person.role]}{person.clientCompany ? ` · ${person.clientCompany.name}` : ""}</p>
            </div>
            {manager && person.userId !== actor.userId ? (
              <ActionForm action={revokeMemberAction} csrf={actor.csrfToken} submitLabel="Remove access" hidden={{ membershipId: person.id }}>
                <span className="sr-only">Remove {person.user.name}</span>
              </ActionForm>
            ) : null}
          </li>
        ))}
      </ul>
      {manager ? (
        <section className="card p-4">
          <h2 className="font-semibold">Invite someone</h2>
          <p className="help mb-3">The link is shown once. Email is recorded but not sent to a live mailbox.</p>
          <ActionForm action={inviteAction} csrf={actor.csrfToken} submitLabel="Create invitation">
            <label className="block"><span className="label">Email</span><input className="field" type="email" name="email" required /></label>
            <label className="block">
              <span className="label">Role</span>
              <select className="field" name="role" defaultValue="TEAM_MEMBER">
                {roles.map((role) => <option key={role} value={role}>{ROLE_LABEL[role as keyof typeof ROLE_LABEL]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Client company (client roles only)</span>
              <select className="field" name="clientCompanyId" defaultValue="">
                <option value="">None</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>
            <fieldset>
              <legend className="label">Add to projects</legend>
              <div className="space-y-1">
                {projects.items.map((project) => (
                  <label key={project.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="projectIds" value={project.id} /> {project.name}
                  </label>
                ))}
              </div>
            </fieldset>
          </ActionForm>
        </section>
      ) : null}
      {invites.length > 0 ? (
        <section>
          <h2 className="font-semibold">Open invitations</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {invites.map((invite) => (
              <li key={invite.id} className="card flex flex-wrap items-center justify-between gap-3 p-3">
                <span>{invite.email} · {ROLE_LABEL[invite.role]} · expires {formatDate(invite.expiresAt)}</span>
                <ActionForm action={revokeInviteAction} csrf={actor.csrfToken} submitLabel="Revoke" hidden={{ invitationId: invite.id }}>
                  <span className="sr-only">Revoke {invite.email}</span>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
