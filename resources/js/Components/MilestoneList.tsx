export function MilestoneList({
    milestones,
}: {
    milestones: Array<{
        id: number;
        name: string;
        description: string | null;
        due_date: string | null;
        total_tasks: number;
        done_tasks: number;
        complete: boolean;
    }>;
}) {
    if (milestones.length === 0) {
        return <p className="text-sm text-muted">No milestones yet. Progress stays at 0 until a milestone is fully done.</p>;
    }

    return (
        <ol className="space-y-3">
            {milestones.map((milestone) => (
                <li key={milestone.id} className="rounded-2xl border border-line bg-paper px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="font-semibold">{milestone.name}</p>
                            {milestone.description ? <p className="text-sm text-muted">{milestone.description}</p> : null}
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-teal">
                            {milestone.complete ? 'Complete' : milestone.total_tasks === 0 ? 'Not started' : `${milestone.done_tasks}/${milestone.total_tasks}`}
                        </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">{milestone.due_date ? `Due ${milestone.due_date}` : 'No due date'}</p>
                </li>
            ))}
        </ol>
    );
}
