import { notFound, redirect } from "next/navigation";
import { createDeliverableAction, nextVersionAction, submitDeliverableAction } from "@/actions/app";
import { ActionForm } from "@/components/forms";
import { Badge, Empty, Notice } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { canDraftDeliverables } from "@/lib/authz";
import { DELIVERABLE_STATUS_LABEL } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { formatWhen, one } from "@/lib/format";
import { listDeliverables } from "@/server/deliverables";
import { requireProject } from "@/server/projects";

export default async function DeliverablesPage({
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
  const deliverables = await listDeliverables(actor, project.id);
  const canDraft = canDraftDeliverables(actor.role);
  const back = `/projects/${project.id}/deliverables`;
  return (
    <div className="space-y-4">
      <Notice code={one(sp.notice)} />
      <p className="help">Approvals are recorded decisions, not electronic signatures. A new submission creates a new version.</p>
      {canDraft ? (
        <div className="card p-4">
          <h2 className="font-semibold">New deliverable</h2>
          <ActionForm action={createDeliverableAction} csrf={actor.csrfToken} submitLabel="Create draft" hidden={{ projectId: project.id, returnTo: back }}>
            <label className="block"><span className="label">Title</span><input className="field" name="title" required /></label>
            <label className="block"><span className="label">Description</span><textarea className="field" name="description" rows={2} /></label>
            <label className="block"><span className="label">External link</span><input className="field" name="externalLink" placeholder="https://" /></label>
          </ActionForm>
        </div>
      ) : null}
      {deliverables.length === 0 ? <Empty title="No deliverables" body="Drafts stay internal until they are submitted." /> : null}
      <ul className="space-y-4">
        {deliverables.map((deliverable) => (
          <li key={deliverable.id} className="card p-4">
            <h2 className="font-semibold">{deliverable.title}</h2>
            {deliverable.description ? <p className="mt-1 text-sm text-ink-600">{deliverable.description}</p> : null}
            <ol className="mt-3 space-y-3">
              {deliverable.versions.map((version) => (
                <li key={version.id} className="rounded-md border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">Version {version.versionNumber}</p>
                    <Badge value={version.status} label={DELIVERABLE_STATUS_LABEL[version.status]} />
                  </div>
                  {version.notes ? <p className="mt-1 text-sm">{version.notes}</p> : null}
                  {version.externalLink ? <p className="mt-1 text-sm"><a className="text-pine-800 underline" href={version.externalLink}>Open link</a></p> : null}
                  <ul className="mt-2 text-sm">
                    {version.files.map((file) => (
                      <li key={file.id}><a className="text-pine-800 underline" href={`/api/files/${file.id}`}>{file.originalName}</a></li>
                    ))}
                  </ul>
                  {version.feedback ? <p className="mt-2 text-sm text-ink-700">Feedback: {version.feedback}</p> : null}
                  {version.decidedAt ? <p className="text-xs text-ink-500">Decided {formatWhen(version.decidedAt)}{version.reviewer ? ` by ${version.reviewer.name}` : ""}</p> : null}
                  {canDraft && version.status === "DRAFT" ? (
                    <div className="mt-3 space-y-3">
                      <form action="/api/files" method="post" encType="multipart/form-data" className="space-y-2">
                        <input type="hidden" name="csrf" value={actor.csrfToken} />
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="deliverableVersionId" value={version.id} />
                        <input type="hidden" name="category" value="DELIVERABLE" />
                        <input type="hidden" name="returnTo" value={back} />
                        <label className="block"><span className="label">Add file to this draft</span><input className="field" type="file" name="file" required /></label>
                        <button className="btn-secondary" type="submit">Upload</button>
                      </form>
                      <ActionForm action={submitDeliverableAction} csrf={actor.csrfToken} submitLabel="Submit for review" pendingLabel="Submitting…" hidden={{ versionId: version.id, returnTo: back }}>
                        <span className="sr-only">Submit version {version.versionNumber}</span>
                      </ActionForm>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
            {canDraft && deliverable.versions[0] && (deliverable.versions[0].status === "CHANGES_REQUESTED" || deliverable.versions[0].status === "APPROVED") ? (
              <div className="mt-3">
                <ActionForm action={nextVersionAction} csrf={actor.csrfToken} submitLabel="Start new version" hidden={{ deliverableId: deliverable.id, returnTo: back }}>
                  <label className="block"><span className="label">Notes for the new version</span><textarea className="field" name="notes" rows={2} /></label>
                </ActionForm>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
