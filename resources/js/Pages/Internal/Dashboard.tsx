import { Head, Link } from '@inertiajs/react';
import { InternalLayout } from '@/Layouts/InternalLayout';
import { EmptyState } from '@/Components/EmptyState';

type Summary = {
    projects_by_status: Record<string, number>;
    overdue_task_count: number;
    overdue_tasks: Array<{ id: number; title: string; due_date: string; project_id: number; project_name: string; assignee_name: string | null }>;
    upcoming_milestones: Array<{ id: number; name: string; due_date: string; project_id: number; project_name: string }>;
    deliverables_awaiting_approval: number;
    workload: Array<{ user_id: number; name: string; open_tasks: number }>;
    outstanding_client_actions: number;
};

const labels: Record<string, string> = {
    PLANNING: 'Planning',
    IN_PROGRESS: 'In progress',
    WAITING_ON_CLIENT: 'Waiting on client',
    ON_HOLD: 'On hold',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
};

function Dashboard({ summary }: { summary: Summary }) {
    return (
        <>
            <Head title="Desk" />
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-teal">Today</p>
                    <h1 className="font-display text-4xl">Studio desk</h1>
                </div>
                <img src="/brand/overview.jpg" alt="" className="h-20 w-36 rounded-2xl object-cover" />
            </div>
            <section className="grid gap-3 sm:grid-cols-3">
                <article className="rounded-3xl bg-pine p-5 text-paper">
                    <p className="text-sm text-[#d7c4a5]">Overdue tasks</p>
                    <p className="font-display text-4xl">{summary.overdue_task_count}</p>
                </article>
                <article className="rounded-3xl border border-line bg-card p-5">
                    <p className="text-sm text-muted">Awaiting client approval</p>
                    <p className="font-display text-4xl text-clay">{summary.deliverables_awaiting_approval}</p>
                </article>
                <article className="rounded-3xl border border-line bg-card p-5">
                    <p className="text-sm text-muted">Waiting on a client</p>
                    <p className="font-display text-4xl">{summary.outstanding_client_actions}</p>
                </article>
            </section>
            <section className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {Object.entries(summary.projects_by_status).map(([status, count]) => (
                    <Link key={status} href={`/projects?status=${status}`} className="rounded-2xl border border-line bg-card px-4 py-3">
                        <p className="text-xs text-muted">{labels[status] ?? status}</p>
                        <p className="font-display text-2xl">{count}</p>
                    </Link>
                ))}
            </section>
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <section className="rounded-3xl border border-line bg-card p-5">
                    <h2 className="font-display text-2xl">Overdue</h2>
                    {summary.overdue_tasks.length === 0 ? <div className="mt-4"><EmptyState title="Nothing overdue" body="Open tasks are still inside their dates." /></div> : (
                        <ul className="mt-4 space-y-3">
                            {summary.overdue_tasks.map((task) => (
                                <li key={task.id}>
                                    <Link href={`/projects/${task.project_id}`} className="font-semibold">{task.title}</Link>
                                    <p className="text-xs text-muted">{task.project_name} · {task.assignee_name ?? 'Unassigned'} · {task.due_date}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
                <section className="rounded-3xl border border-line bg-card p-5">
                    <h2 className="font-display text-2xl">Upcoming milestones</h2>
                    {summary.upcoming_milestones.length === 0 ? <div className="mt-4"><EmptyState title="No milestones due soon" body="The next two weeks are clear." /></div> : (
                        <ul className="mt-4 space-y-3">
                            {summary.upcoming_milestones.map((milestone) => (
                                <li key={milestone.id}>
                                    <Link href={`/projects/${milestone.project_id}`} className="font-semibold">{milestone.name}</Link>
                                    <p className="text-xs text-muted">{milestone.project_name} · {milestone.due_date}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
                <section className="rounded-3xl border border-line bg-card p-5 lg:col-span-2">
                    <h2 className="font-display text-2xl">Workload</h2>
                    {summary.workload.length === 0 ? <p className="mt-3 text-sm text-muted">No open assigned work.</p> : (
                        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                            {summary.workload.map((person) => (
                                <li key={person.user_id} className="flex items-center justify-between rounded-2xl bg-paper px-4 py-3">
                                    <span>{person.name}</span>
                                    <span className="font-display text-2xl">{person.open_tasks}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </>
    );
}

Dashboard.layout = (page: React.ReactNode) => <InternalLayout>{page}</InternalLayout>;

export default Dashboard;
