import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProjectTabs } from "@/components/project-tabs";
import { Badge, ProgressBar } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { PRIORITY_LABEL, PROJECT_STATUS_LABEL } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { progressForProject } from "@/lib/progress";
import { presentProject, requireProject } from "@/server/projects";

export default async function ProjectLayout({
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
  const view = presentProject(project, actor);
  const progress = await progressForProject(project.id);
  const tabs = [
    { href: "", label: "Overview" },
    { href: "/tasks", label: "Tasks" },
    { href: "/board", label: "Board" },
    { href: "/deliverables", label: "Deliverables" },
    { href: "/files", label: "Files" },
    { href: "/activity", label: "Activity" },
    ...(actor.role === "TEAM_MEMBER" ? [] : [{ href: "/invoices", label: "Invoices" }]),
    { href: "/time", label: "Time" },
  ];
  return (
    <div>
      <p className="text-sm text-ink-500">
        <Link className="hover:underline" href="/projects">Projects</Link> / {project.reference}
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="text-sm text-ink-500">{project.clientCompany.name} · Due {formatDate(project.dueDate)}</p>
        </div>
        <div className="flex gap-2">
          <Badge value={project.status} label={PROJECT_STATUS_LABEL[project.status]} />
          <Badge value={project.priority} label={PRIORITY_LABEL[project.priority]} />
        </div>
      </div>
      <div className="mt-4 max-w-md">
        <div className="mb-1 flex justify-between text-sm text-ink-600">
          <span>{progress.percent}% of milestones complete</span>
          <span>{progress.tasksDone}/{progress.tasksTotal} tasks done</span>
        </div>
        <ProgressBar percent={progress.percent} />
      </div>
      {view.agreedFee ? <p className="mt-2 text-sm text-ink-600">Agreed fee on file.</p> : null}
      <div className="mt-4">
        <ProjectTabs base={`/projects/${project.id}`} tabs={tabs} />
      </div>
      {children}
    </div>
  );
}
