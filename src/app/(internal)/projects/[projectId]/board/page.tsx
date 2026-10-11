import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { updateTaskAction } from "@/actions/app";
import { ActionForm } from "@/components/forms";
import { DebouncedSearch, SelectFilter } from "@/components/filters";
import { Badge, Notice } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { PRIORITY_LABEL, TASK_STATUS_LABEL, TASK_STATUSES } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { formatDate, one } from "@/lib/format";
import { requireProject } from "@/server/projects";
import { boardTasks } from "@/server/tasks";

export default async function BoardPage({
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
  const filters = { q: one(sp.q), priority: one(sp.priority), assigneeId: one(sp.assignee), clientVisible: one(sp.visibility) };
  const tasks = await boardTasks(actor, project.id, filters);
  return (
    <div className="space-y-4">
      <Notice code={one(sp.notice)} />
      <Suspense fallback={<p className="help">Loading filters…</p>}>
        <div className="grid gap-3 md:grid-cols-3">
          <DebouncedSearch placeholder="Search the board" />
          <SelectFilter name="priority" label="Priority" value={filters.priority ?? ""} options={[{ value: "", label: "Any priority" }, ...Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value, label }))]} />
          <SelectFilter name="visibility" label="Visibility" value={filters.clientVisible ?? ""} options={[{ value: "", label: "Any visibility" }, { value: "true", label: "Client visible" }, { value: "false", label: "Staff only" }]} />
        </div>
      </Suspense>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {TASK_STATUSES.map((status) => (
          <section key={status} className="w-72 shrink-0" aria-label={TASK_STATUS_LABEL[status]}>
            <h2 className="mb-2 text-sm font-semibold">{TASK_STATUS_LABEL[status]}</h2>
            <ul className="space-y-2">
              {tasks.filter((task) => task.status === status).map((task) => (
                <li key={task.id} className="card p-3">
                  <p className="font-medium">{task.title}</p>
                  <p className="mt-1 text-xs text-ink-500">{task.assignee?.name ?? "Unassigned"} · {formatDate(task.dueDate)}</p>
                  <div className="mt-2"><Badge value={task.priority} label={PRIORITY_LABEL[task.priority]} /></div>
                  <div className="mt-2">
                    <ActionForm action={updateTaskAction} csrf={actor.csrfToken} submitLabel="Move" hidden={{ taskId: task.id, projectId: project.id, returnTo: `/projects/${project.id}/board` }}>
                      <label className="sr-only" htmlFor={`board-${task.id}`}>Move {task.title}</label>
                      <select id={`board-${task.id}`} className="field" name="status" defaultValue={task.status}>
                        {TASK_STATUSES.map((option) => <option key={option} value={option}>{TASK_STATUS_LABEL[option]}</option>)}
                      </select>
                    </ActionForm>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
