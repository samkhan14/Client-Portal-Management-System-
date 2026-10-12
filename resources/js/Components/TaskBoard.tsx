import { router, usePage } from '@inertiajs/react';
import { Badge } from '@/Components/Badge';
import type { SharedProps, TaskRow } from '@/types';

const columns = [
    ['TODO', 'To do'],
    ['IN_PROGRESS', 'In progress'],
    ['BLOCKED', 'Blocked'],
    ['IN_REVIEW', 'In review'],
    ['DONE', 'Done'],
] as const;

export function TaskBoard({ board, projectId, manage }: { board: Record<string, TaskRow[]>; projectId: number; manage: boolean }) {
    const userId = usePage<SharedProps>().props.auth.user?.id;
    return (
        <div className="grid gap-3 md:grid-cols-5">
            {columns.map(([key, label]) => (
                <section key={key} className="rounded-2xl bg-paper p-3">
                    <h3 className="mb-3 text-sm font-semibold">{label}</h3>
                    <div className="space-y-2">
                        {(board[key] ?? []).map((task) => (
                            <article key={task.id} className="rounded-xl border border-line bg-card p-3">
                                <p className="text-sm font-semibold">{task.title}</p>
                                <p className="mt-1 text-xs text-muted">{task.assignee?.name ?? 'Unassigned'}</p>
                                <div className="mt-2">
                                    <Badge value={task.priority} label={task.priority_label} />
                                </div>
                                {(manage || task.assignee?.id === userId) && key !== 'DONE' ? (
                                    <button
                                        type="button"
                                        className="mt-2 text-xs font-semibold text-clay"
                                        onClick={() => {
                                            const next = key === 'TODO' ? 'IN_PROGRESS' : key === 'IN_PROGRESS' ? 'IN_REVIEW' : key === 'IN_REVIEW' ? 'DONE' : 'IN_PROGRESS';
                                            router.post(`/projects/${projectId}/tasks/${task.id}/status`, { status: next }, { preserveScroll: true });
                                        }}
                                    >
                                        Advance
                                    </button>
                                ) : null}
                            </article>
                        ))}
                        {(board[key] ?? []).length === 0 ? <p className="text-xs text-muted">Empty</p> : null}
                    </div>
                </section>
            ))}
        </div>
    );
}
