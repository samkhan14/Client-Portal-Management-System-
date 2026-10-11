import { Head, router, useForm, usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { InternalLayout } from '@/Layouts/InternalLayout';
import { PortalLayout } from '@/Layouts/PortalLayout';
import { EmptyState } from '@/Components/EmptyState';
import { Pagination } from '@/Components/Pagination';
import type { Pager, SharedProps } from '@/types';

function NoticesLayout({ children }: { children: ReactNode }) {
    const role = usePage<SharedProps>().props.auth.membership?.role ?? '';
    const client = role === 'CLIENT_ADMIN' || role === 'CLIENT_COLLABORATOR' || role === 'READ_ONLY';

    return client ? <PortalLayout>{children}</PortalLayout> : <InternalLayout>{children}</InternalLayout>;
}

function Index({ notifications }: { notifications: Pager<{ id: number; title: string; body: string; read_at: string | null; created_at: string | null }> }) {
    const page = usePage<SharedProps>();
    const prefs = page.props.notification_preferences;
    const form = useForm({
        assignments: prefs?.assignments ?? true,
        due_soon: prefs?.due_soon ?? true,
        comments: prefs?.comments ?? true,
        deliverables: prefs?.deliverables ?? true,
        status_changes: prefs?.status_changes ?? true,
        invitations: prefs?.invitations ?? true,
    });

    return (
        <>
            <Head title="Notices" />
            <div className="mb-4 flex items-center justify-between">
                <h1 className="font-display text-4xl">Notices</h1>
                <button type="button" className="text-sm font-semibold text-teal" onClick={() => router.post('/notifications/read-all', {}, { preserveScroll: true })}>Mark all read</button>
            </div>
            {notifications.data.length === 0 ? <EmptyState title="You are caught up" body="Assignments, reviews, and due dates will land here." /> : (
                <ul className="space-y-3">
                    {notifications.data.map((notice) => (
                        <li key={notice.id} className="rounded-2xl border border-line bg-card px-4 py-3">
                            <button type="button" className="text-left" onClick={() => router.post(`/notifications/${notice.id}/read`, {}, { preserveScroll: true })}>
                                <p className="font-semibold">{notice.title}</p>
                                <p className="text-sm text-muted">{notice.body}</p>
                                <p className="text-xs text-muted">{notice.read_at ? 'Read' : 'Unread'}</p>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="mt-4"><Pagination page={notifications.current_page} last={notifications.last_page} total={notifications.total} /></div>
            <form className="mt-8 space-y-2 rounded-3xl border border-line bg-card p-5" onSubmit={(event) => { event.preventDefault(); form.put('/notification-preferences', { preserveScroll: true }); }}>
                <h2 className="font-display text-2xl">Preferences</h2>
                {(Object.keys(form.data) as Array<keyof typeof form.data>).map((key) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={form.data[key]} onChange={(event) => form.setData(key, event.target.checked)} />
                        {key.replaceAll('_', ' ')}
                    </label>
                ))}
                <button type="submit" disabled={form.processing} className="rounded-full bg-pine px-4 py-2 text-sm text-paper disabled:opacity-50">Save preferences</button>
            </form>
        </>
    );
}

Index.layout = (page: React.ReactNode) => <NoticesLayout>{page}</NoticesLayout>;

export default Index;
