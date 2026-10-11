import { Link } from '@inertiajs/react';
import { Badge } from '@/Components/Badge';

export function ProjectHeader({
    project,
    progress,
    href,
}: {
    project: {
        name: string;
        reference: string;
        status: string;
        status_label: string;
        priority: string;
        priority_label: string;
        due_date: string | null;
        client?: { name: string } | null;
        manager?: { name: string } | null;
        outstanding_request?: string | null;
    };
    progress: number;
    href?: string;
}) {
    return (
        <header className="overflow-hidden rounded-3xl border border-line bg-card">
            <div className="grid gap-6 p-6 md:grid-cols-[1.4fr_0.8fr] md:p-8">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">{project.reference}</p>
                    <h1 className="mt-2 break-words font-display text-4xl leading-tight">
                        {href ? <Link href={href}>{project.name}</Link> : project.name}
                    </h1>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Badge value={project.status} label={project.status_label} />
                        <Badge value={project.priority} label={project.priority_label} />
                    </div>
                    <p className="mt-4 text-sm text-muted">
                        {project.client?.name ? `${project.client.name}` : 'Client'} 
                        {project.manager?.name ? ` · led by ${project.manager.name}` : ''}
                        {project.due_date ? ` · due ${project.due_date}` : ''}
                    </p>
                    {project.outstanding_request ? (
                        <p className="mt-4 rounded-2xl bg-foam px-4 py-3 text-sm text-pine">{project.outstanding_request}</p>
                    ) : null}
                </div>
                <div className="flex flex-col justify-end">
                    <p className="text-sm text-muted">Milestone progress</p>
                    <p className="font-display text-5xl text-clay">{progress}%</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
                        <div className="h-full bg-teal" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            </div>
        </header>
    );
}
