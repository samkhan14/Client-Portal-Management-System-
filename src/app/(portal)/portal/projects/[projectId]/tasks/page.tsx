import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { DebouncedSearch, SelectFilter } from "@/components/filters";
import { Badge, Empty, Pagination } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { PRIORITY_LABEL, TASK_STATUS_EXPLAIN, TASK_STATUS_LABEL, TASK_STATUSES } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { formatDate, one, pageOf } from "@/lib/format";
import { requireProject } from "@/server/projects";
import { listTasks } from "@/server/tasks";

export default async function PortalTasksPage({
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
  const { page, pageSize } = pageOf(one(sp.page));
  const filters = { q: one(sp.q), status: one(sp.status), priority: one(sp.priority) };
  const result = await listTasks(actor, project.id, { ...filters, page, pageSize });
  const base = `/portal/projects/${project.id}/tasks`;
  return (
    <div className="space-y-4">
      <p className="help">These are the tasks shared with you. Status is updated by the team.</p>
      <Suspense fallback={<p className="help">Loading filters…</p>}>
        <div className="grid gap-3 md:grid-cols-3">
          <DebouncedSearch placeholder="Search shared tasks" />
          <SelectFilter name="status" label="Status" value={filters.status ?? ""} options={[{ value: "", label: "Any status" }, ...TASK_STATUSES.map((status) => ({ value: status, label: TASK_STATUS_LABEL[status] }))]} />
          <SelectFilter name="priority" label="Priority" value={filters.priority ?? ""} options={[{ value: "", label: "Any priority" }, ...Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value, label }))]} />
        </div>
      </Suspense>
      {result.items.length === 0 ? <Empty title="No shared tasks" body="Tasks the team marks as visible will appear here." /> : (
        <ul className="space-y-2">
          {result.items.map((task) => (
            <li key={task.id} className="card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{task.title}</p>
                <Badge value={task.status} label={TASK_STATUS_LABEL[task.status]} />
              </div>
              <p className="text-sm text-ink-600">{TASK_STATUS_EXPLAIN[task.status]} Due {formatDate(task.dueDate)}.</p>
              {task.description ? <p className="mt-1 whitespace-pre-wrap text-sm">{task.description}</p> : null}
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} pageSize={pageSize} total={result.total} hrefFor={(next) => {
        const params = new URLSearchParams();
        if (filters.q) params.set("q", filters.q);
        if (filters.status) params.set("status", filters.status);
        if (filters.priority) params.set("priority", filters.priority);
        params.set("page", String(next));
        return `${base}?${params.toString()}`;
      }} />
    </div>
  );
}
