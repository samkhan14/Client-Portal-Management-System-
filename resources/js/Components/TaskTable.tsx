import { Link, router, usePage } from '@inertiajs/react';
import { Badge } from '@/Components/Badge';
import { EmptyState } from '@/Components/EmptyState';
import type { SharedProps, TaskRow } from '@/types';

const nextStatus: Record<string, string[]> = {
    TODO: ['IN_PROGRESS', 'BLOCKED'],
    IN_PROGRESS: ['BLOCKED', 'IN_REVIEW', 'TODO'],
    BLOCKED: ['TODO', 'IN_PROGRESS'],
    IN_REVIEW: ['IN_PROGRESS', 'DONE'],
    DONE: ['IN_PROGRESS'],
};

export function TaskTable({ tasks, manage = false, projectId }: { tasks: TaskRow[]; manage?: boolean; projectId?: number }) {
    const userId = usePage<SharedProps>().props.auth.user?.id;
    if (tasks.length === 0) {
        return <EmptyState title="No tasks in this view" body="Adjust the filters or add a task to this project." />;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted">
                    <tr>
                        <th className="py-2 pr-3 font-semibold">Task</th>
                        <th className="py-2 pr-3 font-semibold">Status</th>
                        <th className="py-2 pr-3 font-semibold">Priority</th>
                        <th className="py-2 pr-3 font-semibold">Assignee</th>
                        <th className="py-2 font-semibold">Due</th>
                    </tr>
                </thead>
                <tbody>
                    {tasks.map((task) => (
                        <tr key={task.id} className="border-t border-line align-top">
                            <td className="py-3 pr-3">
                                <p className="font-semibold">
                                    {task.parent_id ? <span className="text-muted">↳ </span> : null}
                                    {task.project_name && !projectId ? (
                                        <Link href={`/projects/${task.project_id}`}>{task.title}</Link>
                                    ) : (
                                        task.title
                                    )}
                                </p>
                                {task.milestone ? <p className="text-xs text-muted">{task.milestone.name}</p> : null}
                                {task.estimate_hours ? <p className="text-xs text-muted">{task.estimate_hours}h estimate</p> : null}
                            </td>
                            <td className="py-3 pr-3">
                                <Badge value={task.status} label={task.status_label} />
                                {projectId && (manage || task.assignee?.id === userId) ? (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {(nextStatus[task.status] ?? []).map((status) => (
                                            <button
                                                key={status}
                                                type="button"
                                                className="rounded-full border border-line px-2 py-0.5 text-[11px]"
                                                onClick={() => router.post(`/projects/${projectId}/tasks/${task.id}/status`, { status }, { preserveScroll: true })}
                                            >
                                                {status.replaceAll('_', ' ').toLowerCase()}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </td>
                            <td className="py-3 pr-3">
                                <Badge value={task.priority} label={task.priority_label} />
                            </td>
                            <td className="py-3 pr-3">{task.assignee?.name ?? 'Unassigned'}</td>
                            <td className="py-3">{task.due_date ?? '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
