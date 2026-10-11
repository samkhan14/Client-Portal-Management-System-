import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProjectTabs } from "@/components/project-tabs";
import { Badge, ProgressBar } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { PROJECT_STATUS_EXPLAIN, PROJECT_STATUS_LABEL } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { progressForProject } from "@/lib/progress";
import { requireProject } from "@/server/projects";

export default async function PortalProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const { projectId } = await params;
  const project = await requireProject(actor, projectId).catch((error: unknown) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  const progress = await progressForProject(project.id);
  return (
    <div>
      <p className="text-sm text-ink-500"><Link href="/portal" className="hover:underline">Projects</Link> / {project.reference}</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-600">{PROJECT_STATUS_EXPLAIN[project.status]}</p>
        </div>
        <Badge value={project.status} label={PROJECT_STATUS_LABEL[project.status]} />
      </div>
      <p className="mt-2 text-sm text-ink-500">Due {formatDate(project.dueDate)} · {progress.percent}% of milestones complete</p>
      <div className="mt-3 max-w-md">
        <ProgressBar percent={progress.percent} />
      </div>
      <div className="mt-4">
        <ProjectTabs
          base={`/portal/projects/${project.id}`}
          tabs={[
            { href: "", label: "Overview" },
            { href: "/tasks", label: "Tasks" },
            { href: "/deliverables", label: "Approvals" },
            { href: "/files", label: "Documents" },
            { href: "/activity", label: "Activity" },
          ]}
        />
      </div>
      {children}
    </div>
  );
}
