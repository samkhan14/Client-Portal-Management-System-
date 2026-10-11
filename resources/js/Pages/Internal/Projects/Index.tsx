import { Head, Link } from '@inertiajs/react';
import { InternalLayout } from '@/Layouts/InternalLayout';
import { Badge } from '@/Components/Badge';
import { EmptyState } from '@/Components/EmptyState';
import { Pagination } from '@/Components/Pagination';
import { SearchField, applyFilter } from '@/Components/SearchField';
import { usePage } from '@inertiajs/react';
import type { Option, Pager, SharedProps } from '@/types';

type ProjectCard = {
    id: number;
    name: string;
    reference: string;
    status: string;
    status_label: string;
    priority: string;
    priority_label: string;
    due_date: string | null;
    client: string | null;
    manager: string | null;
    progress: number;
};

function Index({
    filters,
    projects,
    clients,
    statuses,
}: {
    filters: { q: string; status: string; priority: string; client: string };
    projects: Pager<ProjectCard>;
    clients: Option[];
    statuses: Array<{ value: string; label: string }>;
}) {
    const { abilities } = usePage<SharedProps>().props;

    return (
        <>
            <Head title="Projects" />
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <h1 className="font-display text-4xl">Projects</h1>
                {abilities.manage_projects ? <Link href="/projects/create" className="rounded-full bg-clay px-4 py-2 text-sm font-semibold text-white">New project</Link> : null}
            </div>
            <div className="mb-5 grid gap-3 md:grid-cols-4">
                <SearchField initial={filters.q} />
                <select className="input" aria-label="Status" value={filters.status} onChange={(event) => applyFilter('status', event.target.value)}>
                    <option value="">All statuses</option>
                    {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
                <select className="input" aria-label="Priority" value={filters.priority} onChange={(event) => applyFilter('priority', event.target.value)}>
                    <option value="">All priorities</option>
                    {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </select>
                <select className="input" aria-label="Client" value={filters.client} onChange={(event) => applyFilter('client', event.target.value)}>
                    <option value="">All clients</option>
                    {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
            </div>
            {projects.data.length === 0 ? <EmptyState title="No projects match" body="Try another filter, or open a project for a client company." /> : (
                <ul className="space-y-3">
                    {projects.data.map((project) => (
                        <li key={project.id}>
                            <Link href={`/projects/${project.id}`} className="block rounded-3xl border border-line bg-card p-5 hover:border-teal">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.16em] text-teal">{project.reference}</p>
                                        <h2 className="font-display text-2xl">{project.name}</h2>
                                        <p className="text-sm text-muted">{project.client} · {project.manager}{project.due_date ? ` · due ${project.due_date}` : ''}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-display text-3xl text-clay">{project.progress}%</p>
                                        <div className="mt-2 flex gap-2">
                                            <Badge value={project.status} label={project.status_label} />
                                            <Badge value={project.priority} label={project.priority_label} />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            <div className="mt-6">
                <Pagination page={projects.current_page} last={projects.last_page} total={projects.total} />
            </div>
        </>
    );
}

Index.layout = (page: React.ReactNode) => <InternalLayout>{page}</InternalLayout>;

export default Index;
