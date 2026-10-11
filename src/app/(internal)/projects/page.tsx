import Link from "next/link";
import { Suspense } from "react";
import { DebouncedSearch, SelectFilter } from "@/components/filters";
import { Badge, Empty, Notice, Pagination } from "@/components/ui";
import { PRIORITY_LABEL, PROJECT_STATUS_LABEL } from "@/lib/constants";
import { formatDate, one, pageOf } from "@/lib/format";
import { getActor } from "@/lib/auth/current";
import { canManageAllProjects } from "@/lib/authz";
import { redirect } from "next/navigation";
import { progressForProjects } from "@/lib/progress";
import { listProjects } from "@/server/projects";
import { listClientCompanies } from "@/server/org";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const sp = await searchParams;
  const { page, pageSize } = pageOf(one(sp.page));
  const filters = {
    q: one(sp.q),
    status: one(sp.status),
    priority: one(sp.priority),
    clientCompanyId: one(sp.client),
  };
  const [result, companies] = await Promise.all([
    listProjects(actor, { ...filters, page, pageSize }),
    listClientCompanies(actor),
  ]);
  const progress = await progressForProjects(result.items.map((project) => project.id));
  const query = {
    q: filters.q,
    status: filters.status,
    priority: filters.priority,
    client: filters.clientCompanyId,
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="help">{result.total} in view</p>
        </div>
        {canManageAllProjects(actor.role) ? (
          <Link className="btn" href="/projects/new">
            New project
          </Link>
        ) : null}
      </div>
      <Notice code={one(sp.notice)} />
      <Suspense fallback={<p className="help">Loading filters…</p>}>
        <div className="grid gap-3 md:grid-cols-4">
          <DebouncedSearch placeholder="Search name or reference" />
          <SelectFilter name="status" label="Status" value={filters.status ?? ""} options={[{ value: "", label: "Any status" }, ...Object.entries(PROJECT_STATUS_LABEL).map(([value, label]) => ({ value, label }))]} />
          <SelectFilter name="priority" label="Priority" value={filters.priority ?? ""} options={[{ value: "", label: "Any priority" }, ...Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value, label }))]} />
          <SelectFilter name="client" label="Client" value={filters.clientCompanyId ?? ""} options={[{ value: "", label: "Any client" }, ...companies.map((company) => ({ value: company.id, label: company.name }))]} />
        </div>
      </Suspense>
      {result.items.length === 0 ? (
        <Empty title="No projects" body="Try another filter, or create a project for a client company." />
      ) : (
        <ul className="grid gap-3">
          {result.items.map((project) => {
            const stats = progress.get(project.id);
            return (
              <li key={project.id}>
                <Link href={`/projects/${project.id}`} className="card block p-4 hover:border-pine-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{project.name}</p>
                      <p className="text-sm text-ink-500">{project.reference} · {project.clientCompany.name}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge value={project.status} label={PROJECT_STATUS_LABEL[project.status]} />
                      <Badge value={project.priority} label={PRIORITY_LABEL[project.priority]} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-ink-600">
                    Due {formatDate(project.dueDate)} · {stats?.percent ?? 0}% of milestones complete
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination
        page={page}
        pageSize={pageSize}
        total={result.total}
        hrefFor={(next) => {
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
          params.set("page", String(next));
          return `/projects?${params.toString()}`;
        }}
      />
    </div>
  );
}
