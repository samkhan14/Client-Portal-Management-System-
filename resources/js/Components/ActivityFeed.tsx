import { EmptyState } from '@/Components/EmptyState';

export function ActivityFeed({
    activities,
}: {
    activities: Array<{ id: number; summary: string; actor: string | null; created_at: string | null; client_visible: boolean }>;
}) {
    if (activities.length === 0) {
        return <EmptyState title="No activity yet" body="Status changes, assignments, and approvals will show up here." />;
    }

    return (
        <ol className="space-y-3">
            {activities.map((item) => (
                <li key={item.id} className="border-l-2 border-teal pl-3">
                    <p className="text-sm">{item.summary}</p>
                    <p className="text-xs text-muted">
                        {item.actor ?? 'System'}
                        {item.client_visible ? '' : ' · internal'}
                    </p>
                </li>
            ))}
        </ol>
    );
}
