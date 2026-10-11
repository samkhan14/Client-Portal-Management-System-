import { notFound, redirect } from "next/navigation";
import { timeAction } from "@/actions/app";
import { ActionForm } from "@/components/forms";
import { Empty, Notice } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { AppError } from "@/lib/errors";
import { formatDate, one } from "@/lib/format";
import { listTimeEntries } from "@/server/finance";
import { requireProject } from "@/server/projects";
import { prisma } from "@/lib/db";

export default async function TimePage({
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
  const [{ entries, totals }, tasks] = await Promise.all([
    listTimeEntries(actor, project.id),
    prisma.task.findMany({ where: { projectId: project.id }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  const billable = totals.find((row) => row.billable)?._sum.minutes ?? 0;
  const nonBillable = totals.find((row) => !row.billable)?._sum.minutes ?? 0;
  return (
    <div className="space-y-4">
      <Notice code={one(sp.notice)} />
      <p className="help">Time entries are internal. Clients never see them.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4"><p className="text-sm text-ink-500">Billable minutes</p><p className="text-2xl font-semibold">{billable}</p></div>
        <div className="card p-4"><p className="text-sm text-ink-500">Non-billable minutes</p><p className="text-2xl font-semibold">{nonBillable}</p></div>
      </div>
      <div className="card p-4">
        <h2 className="font-semibold">Log time</h2>
        <ActionForm action={timeAction} csrf={actor.csrfToken} submitLabel="Save entry" hidden={{ projectId: project.id }}>
          <label className="block">
            <span className="label">Task</span>
            <select className="field" name="taskId" required defaultValue="">
              <option value="" disabled>Choose a task</option>
              {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="label">Minutes</span><input className="field" name="minutes" type="number" min={1} max={1440} required /></label>
            <label className="block"><span className="label">Date</span><input className="field" type="date" name="workDate" required /></label>
          </div>
          <label className="block"><span className="label">Note</span><input className="field" name="note" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="billable" defaultChecked /> Billable</label>
        </ActionForm>
      </div>
      {entries.length === 0 ? <Empty title="No time logged" body="Entries you save stay inside the agency." /> : (
        <ul className="space-y-2 text-sm">
          {entries.map((entry) => (
            <li key={entry.id} className="card p-3">
              <p className="font-medium">{entry.minutes} min · {entry.task.title}</p>
              <p className="text-ink-500">{entry.user.name} · {formatDate(entry.workDate)} · {entry.billable ? "Billable" : "Non-billable"}{entry.note ? ` · ${entry.note}` : ""}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
