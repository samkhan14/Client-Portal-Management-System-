import Link from "next/link";
import { Badge, ProgressBar } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { PROJECT_STATUS_EXPLAIN, PROJECT_STATUS_LABEL } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { progressForProjects } from "@/lib/progress";
import { clientDashboard } from "@/server/dashboard";
import { redirect } from "next/navigation";

export default async function PortalHomePage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const data = await clientDashboard(actor);
  const progress = await progressForProjects(data.projects.map((project) => project.id));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Your projects</h1>
        <p className="help">What is moving, what needs you, and what is already approved.</p>
      </div>
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4"><p className="text-sm text-ink-500">Waiting for your review</p><p className="text-3xl font-semibold">{data.pendingApprovals}</p></div>
        <div className="card p-4"><p className="text-sm text-ink-500">Shared tasks past due</p><p className="text-3xl font-semibold">{data.overdueTasks}</p></div>
      </section>
      {data.waiting.length > 0 ? (
        <section className="card p-4">
          <h2 className="font-semibold">We need something from you</h2>
          <ul className="mt-3 space-y-3">
            {data.waiting.map((project) => (
              <li key={project.id}>
                <Link className="font-medium text-pine-800 hover:underline" href={`/portal/projects/${project.id}`}>{project.name}</Link>
                <p className="text-sm text-ink-700">{project.outstandingRequest}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ul className="grid gap-3">
        {data.projects.map((project) => {
          const stats = progress.get(project.id);
          return (
            <li key={project.id}>
              <Link href={`/portal/projects/${project.id}`} className="card block p-4 hover:border-pine-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{project.name}</p>
                    <p className="text-sm text-ink-500">{project.reference} · Due {formatDate(project.dueDate)}</p>
                  </div>
                  <Badge value={project.status} label={PROJECT_STATUS_LABEL[project.status]} />
                </div>
                <p className="mt-2 text-sm text-ink-600">{PROJECT_STATUS_EXPLAIN[project.status]}</p>
                <div className="mt-3 max-w-md"><ProgressBar percent={stats?.percent ?? 0} /></div>
                {project.agreedFee ? <p className="mt-2 text-sm">Agreed fee {formatMoney(project.agreedFee)}</p> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
