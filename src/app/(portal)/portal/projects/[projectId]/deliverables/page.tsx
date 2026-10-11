import { notFound, redirect } from "next/navigation";
import { decideDeliverableAction } from "@/actions/app";
import { DialogForm } from "@/components/forms";
import { Badge, Empty, Notice } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { canApproveDeliverables } from "@/lib/authz";
import { DELIVERABLE_STATUS_LABEL } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { formatWhen, one } from "@/lib/format";
import { listDeliverables } from "@/server/deliverables";
import { requireProject } from "@/server/projects";

export default async function PortalDeliverablesPage({
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
  const canApprove = canApproveDeliverables(actor.role);
  const back = `/portal/projects/${project.id}/deliverables`;
  return (
    <div className="space-y-4">
      <Notice code={one(sp.notice)} />
      <p className="help">
        {canApprove
          ? "You can approve a submitted version or ask for changes. The decision is stored with the version."
          : "You can follow reviews here. Only a client admin can approve."}
      </p>
      {deliverables.length === 0 ? <Empty title="Nothing to review" body="Submitted work will show up here." /> : null}
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
                  {version.externalLink ? <a className="mt-1 inline-block text-sm text-pine-800 underline" href={version.externalLink}>Open link</a> : null}
                  <ul className="mt-2 text-sm">
                    {version.files.map((file) => <li key={file.id}><a className="text-pine-800 underline" href={`/api/files/${file.id}`}>{file.originalName}</a></li>)}
                  </ul>
                  {version.feedback ? <p className="mt-2 text-sm">Feedback: {version.feedback}</p> : null}
                  {version.decidedAt ? <p className="text-xs text-ink-500">Recorded {formatWhen(version.decidedAt)}</p> : null}
                  {canApprove && version.status === "SUBMITTED" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <DialogForm title={`Approve version ${version.versionNumber}`} trigger="Approve" action={decideDeliverableAction} csrf={actor.csrfToken} submitLabel="Confirm approval" hidden={{ versionId: version.id, decision: "APPROVED", returnTo: back }}>
                        <p className="text-sm text-ink-600">This records your approval of version {version.versionNumber}. It does not replace a contract.</p>
                        <label className="block"><span className="label">Note (optional)</span><textarea className="field" name="feedback" rows={2} /></label>
                      </DialogForm>
                      <DialogForm title="Request changes" trigger="Request changes" action={decideDeliverableAction} csrf={actor.csrfToken} submitLabel="Send request" hidden={{ versionId: version.id, decision: "CHANGES_REQUESTED", returnTo: back }}>
                        <label className="block"><span className="label">What should change?</span><textarea className="field" name="feedback" rows={3} required /></label>
                      </DialogForm>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </div>
  );
}
