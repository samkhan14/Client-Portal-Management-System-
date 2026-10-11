import { notFound, redirect } from "next/navigation";
import { commentAction } from "@/actions/app";
import { ActionForm } from "@/components/forms";
import { Notice } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { canComment } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { formatWhen, one } from "@/lib/format";
import { listActivity, listComments } from "@/server/comments";
import { requireProject } from "@/server/projects";

export default async function PortalActivityPage({
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
  const [comments, activity] = await Promise.all([listComments(actor, project.id), listActivity(actor, project.id)]);
  const back = `/portal/projects/${project.id}/activity`;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <h2 className="font-semibold">Conversation</h2>
        <Notice code={one(sp.notice)} />
        {canComment(actor.role) ? (
          <div className="card p-4">
            <ActionForm action={commentAction} csrf={actor.csrfToken} submitLabel="Send" hidden={{ projectId: project.id, returnTo: back, clientVisible: "on" }}>
              <label className="block"><span className="label">Message</span><textarea className="field" name="body" rows={3} required /></label>
            </ActionForm>
          </div>
        ) : <p className="help">You can read updates. This role cannot post messages.</p>}
        <ol className="space-y-2">
          {comments.map((comment) => (
            <li key={comment.id} className="card p-3">
              <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
              <p className="mt-1 text-xs text-ink-500">{comment.authorName} · {formatWhen(comment.createdAt)}</p>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2 className="font-semibold">Updates</h2>
        <ol className="mt-3 space-y-2">
          {activity.map((event) => (
            <li key={event.id} className="border-l-2 border-pine-100 pl-3">
              <p className="text-sm">{event.summary}</p>
              <p className="text-xs text-ink-500">{formatWhen(event.createdAt)}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
