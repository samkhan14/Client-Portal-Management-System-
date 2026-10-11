import Link from "next/link";
import { Badge } from "@/components/ui";
import { PROJECT_STATUS_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { getActor } from "@/lib/auth/current";
import { redirect } from "next/navigation";
import { internalDashboard } from "@/server/dashboard";

export default async function DashboardPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const data = await internalDashboard(actor);
  const cards = [
    ["Overdue tasks", String(data.overdueTasks)],
    ["Awaiting approval", String(data.awaitingApproval)],
    ["Waiting on client", String(data.waitingOnClient)],
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="help">Delivery across {actor.organizationName}.</p>
      </div>
      <section className="grid gap-3 sm:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-sm text-ink-500">{label}</p>
            <p className="mt-1 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </section>
      <section className="card p-4">
        <h2 className="font-semibold">Projects by status</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {data.projectsByStatus.length === 0 ? <li className="help">No projects yet.</li> : null}
          {data.projectsByStatus.map((row) => (
            <li key={row.status}>
              <Link href={`/projects?status=${row.status}`} className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-sm">
                <Badge value={row.status} label={PROJECT_STATUS_LABEL[row.status]} />
                <span>{row.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="font-semibold">Upcoming milestones</h2>
          <ul className="mt-3 space-y-2">
            {data.upcomingMilestones.length === 0 ? <li className="help">Nothing due in the next 14 days.</li> : null}
            {data.upcomingMilestones.map((milestone) => (
              <li key={milestone.id} className="flex items-center justify-between gap-3 text-sm">
                <Link className="font-medium text-pine-800 hover:underline" href={`/projects/${milestone.project.id}`}>
                  {milestone.title}
                </Link>
                <span className="text-ink-500">{formatDate(milestone.dueDate)} · {milestone.project.reference}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-4">
          <h2 className="font-semibold">Team workload</h2>
          <p className="help">Open tasks per assignee.</p>
          <ul className="mt-3 space-y-2">
            {data.workload.length === 0 ? <li className="help">No open assigned tasks.</li> : null}
            {data.workload.map((row) => (
              <li key={row.assigneeId ?? "none"} className="flex items-center justify-between text-sm">
                <span>{row.name}</span>
                <span className="font-semibold">{row.openTasks}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
