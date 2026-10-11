import { notFound, redirect } from "next/navigation";
import { deleteFileAction } from "@/actions/app";
import { ActionForm } from "@/components/forms";
import { Empty, Notice } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { canUpload } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { formatWhen, one } from "@/lib/format";
import { listFiles } from "@/server/files";
import { requireProject } from "@/server/projects";

const categories = ["BRIEF", "DELIVERABLE", "REFERENCE", "CONTRACT", "OTHER"];

export default async function FilesPage({
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
  const files = await listFiles(actor, project.id, one(sp.category));
  const back = `/projects/${project.id}/files`;
  return (
    <div className="space-y-4">
      <Notice code={one(sp.notice)} />
      {one(sp.uploadError) ? <p role="alert" className="text-sm text-red-800">{one(sp.uploadError)}</p> : null}
      {canUpload(actor.role) ? (
        <form action="/api/files" method="post" encType="multipart/form-data" className="card space-y-3 p-4">
          <h2 className="font-semibold">Upload</h2>
          <input type="hidden" name="csrf" value={actor.csrfToken} />
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="returnTo" value={back} />
          <label className="block"><span className="label">File</span><input className="field" type="file" name="file" required /></label>
          <label className="block">
            <span className="label">Category</span>
            <select className="field" name="category" defaultValue="OTHER">
              {categories.map((category) => <option key={category} value={category}>{category.toLowerCase()}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="clientVisible" /> Visible to the client</label>
          <button className="btn" type="submit">Upload file</button>
        </form>
      ) : null}
      {files.length === 0 ? <Empty title="No files" body="Shared and internal files for this project show up here." /> : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li key={file.id} className="card flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <div>
                <a className="font-medium text-pine-800 underline" href={`/api/files/${file.id}`}>{file.originalName}</a>
                <p className="text-ink-500">{file.category.toLowerCase()} · {(file.sizeBytes / 1024).toFixed(1)} KB · {formatWhen(file.createdAt)} · {file.clientVisible ? "Client visible" : "Staff only"}</p>
              </div>
              <ActionForm action={deleteFileAction} csrf={actor.csrfToken} submitLabel="Remove" hidden={{ fileId: file.id, returnTo: back }}>
                <span className="sr-only">Remove {file.originalName}</span>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
