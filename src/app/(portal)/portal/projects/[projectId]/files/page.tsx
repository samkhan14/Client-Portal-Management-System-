import { notFound, redirect } from "next/navigation";
import { Empty } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { AppError } from "@/lib/errors";
import { formatWhen } from "@/lib/format";
import { listFiles } from "@/server/files";
import { requireProject } from "@/server/projects";

export default async function PortalFilesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const { projectId } = await params;
  const project = await requireProject(actor, projectId).catch((error: unknown) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  const files = await listFiles(actor, project.id);
  if (files.length === 0) return <Empty title="No shared documents" body="Files the team shares with you will be listed here." />;
  return (
    <ul className="space-y-2">
      {files.map((file) => (
        <li key={file.id} className="card p-3 text-sm">
          <a className="font-medium text-pine-800 underline" href={`/api/files/${file.id}`}>{file.originalName}</a>
          <p className="text-ink-500">{file.category.toLowerCase()} · {formatWhen(file.createdAt)}</p>
        </li>
      ))}
    </ul>
  );
}
