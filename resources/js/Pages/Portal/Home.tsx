import { Head, Link } from '@inertiajs/react';
import { PortalLayout } from '@/Layouts/PortalLayout';
import { Badge } from '@/Components/Badge';
import { EmptyState } from '@/Components/EmptyState';

function Home({
    company,
    projects,
    pending_approvals,
    waiting_on_you,
}: {
    company: string | null;
    projects: Array<{ id: number; name: string; reference: string; status: string; status_label: string; due_date: string | null; progress: number }>;
    pending_approvals: Array<{ id: number; title: string; version_number: number; project_id: number; project_name: string; status_label: string }>;
    waiting_on_you: Array<{ id: number; name: string; outstanding_request: string | null }>;
}) {
    return (
        <>
            <Head title="Your work" />
            <p className="text-xs uppercase tracking-[0.18em] text-teal">{company ?? 'Client'}</p>
            <h1 className="font-display text-4xl">What is moving</h1>
            <img src="/brand/overview.jpg" alt="" className="mt-4 h-40 w-full rounded-3xl object-cover" />
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <section>
                    <h2 className="font-display text-2xl">Projects</h2>
                    {projects.length === 0 ? <div className="mt-3"><EmptyState title="No projects yet" body="When the studio adds you to a project, it will appear here." /></div> : (
                        <ul className="mt-3 space-y-3">
                            {projects.map((project) => (
                                <li key={project.id}>
                                    <Link href={`/portal/projects/${project.id}`} className="block rounded-3xl border border-line bg-card p-5">
                                        <p className="text-xs uppercase tracking-[0.16em] text-muted">{project.reference}</p>
                                        <div className="mt-1 flex items-center justify-between gap-3">
                                            <h3 className="font-display text-2xl">{project.name}</h3>
                                            <span className="font-display text-2xl text-clay">{project.progress}%</span>
                                        </div>
                                        <div className="mt-2"><Badge value={project.status} label={project.status_label} /></div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
                <section className="space-y-6">
                    <div className="rounded-3xl bg-pine p-5 text-paper">
                        <h2 className="font-display text-2xl">Waiting on you</h2>
                        {waiting_on_you.length === 0 ? <p className="mt-2 text-sm text-[#d7c4a5]">Nothing is blocked on your reply.</p> : waiting_on_you.map((item) => (
                            <Link key={item.id} href={`/portal/projects/${item.id}`} className="mt-3 block rounded-2xl bg-pine-soft p-3 text-sm">{item.name}: {item.outstanding_request}</Link>
                        ))}
                    </div>
                    <div className="rounded-3xl border border-line bg-card p-5">
                        <h2 className="font-display text-2xl">Ready for review</h2>
                        {pending_approvals.length === 0 ? <p className="mt-2 text-sm text-muted">No deliverables are waiting.</p> : pending_approvals.map((item) => (
                            <Link key={item.id} href={`/portal/projects/${item.project_id}`} className="mt-3 block text-sm">
                                <span className="font-semibold">{item.title}</span> version {item.version_number} · {item.project_name} · {item.status_label}
                            </Link>
                        ))}
                    </div>
                </section>
            </div>
        </>
    );
}

Home.layout = (page: React.ReactNode) => <PortalLayout>{page}</PortalLayout>;
export default Home;
