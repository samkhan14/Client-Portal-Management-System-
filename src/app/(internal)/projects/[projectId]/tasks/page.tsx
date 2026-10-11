import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { createTaskAction, updateTaskAction } from "@/actions/app";
import { ActionForm } from "@/components/forms";
import { DebouncedSearch, SelectFilter } from "@/components/filters";
import { Badge, Empty, Notice, Pagination } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { canManageAllProjects } from "@/lib/authz";
import { PRIORITY_LABEL, TASK_STATUS_LABEL, TASK_STATUSES } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { formatDate, one, pageOf } from "@/lib/format";
import { requireProject } from "@/server/projects";
import { listMilestones, listTasks } from "@/server/tasks";

export default async function TasksPage({
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
  const filters = {
    q: one(sp.q),
    status: one(sp.status),
    priority: one(sp.priority),
    assigneeId: one(sp.assignee),
    clientVisible: one(sp.visibility),
  };
  const [result, milestones] = await Promise.all([
    listTasks(actor, project.id, { ...filters, page, pageSize }),
    listMilestones(actor, project.id),
  ]);
  const manager = canManageAllProjects(actor.role);
  const base = `/projects/${project.id}/tasks`;
  return (
    <div className="space-y-4">
      <Notice code={one(sp.notice)} />
      <Suspense fallback={<p className="help">Loading filters…</p>}>
        <div className="grid gap-3 md:grid-cols-4">
          <DebouncedSearch placeholder="Search tasks" />
          <SelectFilter name="status" label="Status" value={filters.status ?? ""} options={[{ value: "", label: "Any status" }, ...TASK_STATUSES.map((status) => ({ value: status, label: TASK_STATUS_LABEL[status] }))]} />
          <SelectFilter name="priority" label="Priority" value={filters.priority ?? ""} options={[{ value: "", label: "Any priority" }, ...Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value, label }))]} />
          <SelectFilter name="visibility" label="Visibility" value={filters.clientVisible ?? ""} options={[{ value: "", label: "Any visibility" }, { value: "true", label: "Client visible" }, { value: "false", label: "Staff only" }]} />
        </div>
      </Suspense>
      {manager ? (
        <details className="card p-4">
          <summary className="cursor-pointer font-medium">Add a task</summary>
          <div className="mt-3">
            <ActionForm action={createTaskAction} csrf={actor.csrfToken} submitLabel="Create task" hidden={{ projectId: project.id, returnTo: base }}>
              <label className="block"><span className="label">Title</span><input className="field" name="title" required /></label>
              <label className="block"><span className="label">Description</span><textarea className="field" name="description" rows={2} /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="label">Assignee</span>
                  <select className="field" name="assigneeId" defaultValue="">
                    <option value="">Unassigned</option>
                    {project.members.filter((member) => member.role !== "READ_ONLY").map((member) => (
                      <option key={member.userId} value={member.userId}>{member.user.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Milestone</span>
                  <select className="field" name="milestoneId" defaultValue="">
                    <option value="">None</option>
                    {milestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="label">Due</span><input className="field" type="date" name="dueDate" /></label>
                <label className="block"><span className="label">Estimate hours</span><input className="field" name="estimateHours" inputMode="decimal" /></label>
              </div>
              <label className="block">
                <span className="label">Priority</span>
                <select className="field" name="priority" defaultValue="MEDIUM">
                  {Object.entries(PRIORITY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="label">Blocked by task id</span>
                <input className="field" name="blockedByTaskId" placeholder="Optional task id in this project" />
              </label>
              <label className="block">
                <span className="label">Parent task id</span>
                <input className="field" name="parentTaskId" placeholder="Optional, one level only" />
              </label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="clientVisible" /> Visible to the client</label>
            </ActionForm>
          </div>
        </details>
      ) : null}
      {result.items.length === 0 ? <Empty title="No tasks" body="Nothing matches these filters." /> : (
        <div className="overflow-x-auto card">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line text-ink-500">
              <tr>
                <th className="px-3 py-2 font-medium">Task</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Assignee</th>
                <th className="px-3 py-2 font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((task) => (
                <tr key={task.id} className="border-b border-line align-top">
                  <td className="px-3 py-3">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-ink-500">
                      {task.parent ? `Subtask of ${task.parent.title} · ` : ""}
                      <Badge value={task.priority} label={PRIORITY_LABEL[task.priority]} />
                      {task.clientVisible ? " · Client visible" : " · Staff only"}
                      {task.estimateHours ? ` · ${task.estimateHours.toString()}h` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <ActionForm action={updateTaskAction} csrf={actor.csrfToken} submitLabel="Save" hidden={{ taskId: task.id, projectId: project.id, returnTo: base }}>
                      <label className="sr-only" htmlFor={`status-${task.id}`}>Status for {task.title}</label>
                      <select id={`status-${task.id}`} className="field" name="status" defaultValue={task.status}>
                        {TASK_STATUSES.map((status) => <option key={status} value={status}>{TASK_STATUS_LABEL[status]}</option>)}
                      </select>
                    </ActionForm>
                  </td>
                  <td className="px-3 py-3">{task.assignee?.name ?? "—"}</td>
                  <td className="px-3 py-3">{formatDate(task.dueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={page}
        pageSize={pageSize}
        total={result.total}
        hrefFor={(next) => {
          const params = new URLSearchParams();
          if (filters.q) params.set("q", filters.q);
          if (filters.status) params.set("status", filters.status);
          if (filters.priority) params.set("priority", filters.priority);
          if (filters.assigneeId) params.set("assignee", filters.assigneeId);
          if (filters.clientVisible) params.set("visibility", filters.clientVisible);
          params.set("page", String(next));
          return `${base}?${params.toString()}`;
        }}
      />
    </div>
  );
}
