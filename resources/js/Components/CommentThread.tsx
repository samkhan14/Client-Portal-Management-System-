import { useForm } from '@inertiajs/react';
import { EmptyState } from '@/Components/EmptyState';

type Comment = {
    id: number;
    body: string;
    client_visible: boolean;
    created_at: string | null;
    author: string | null;
    file: { id: number; name: string } | null;
};

export function CommentThread({
    comments,
    action,
    allowVisibility,
    canPost,
}: {
    comments: Comment[];
    action: string;
    allowVisibility: boolean;
    canPost: boolean;
}) {
    const form = useForm({ body: '', client_visible: allowVisibility ? false : true, upload: null as File | null });

    return (
        <div className="space-y-4">
            {comments.length === 0 ? <EmptyState title="No comments yet" body="Notes posted here stay with the project record." /> : null}
            <ul className="space-y-3">
                {comments.map((comment) => (
                    <li key={comment.id} className="rounded-2xl border border-line bg-paper px-4 py-3">
                        <div className="flex items-center justify-between gap-3 text-xs text-muted">
                            <span>{comment.author ?? 'Someone'}</span>
                            <span>{comment.client_visible ? 'Shared with client' : 'Internal'}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm">{comment.body}</p>
                        {comment.file ? (
                            <a className="mt-2 inline-block text-sm font-semibold text-teal" href={`/files/${comment.file.id}/download`}>
                                {comment.file.name}
                            </a>
                        ) : null}
                    </li>
                ))}
            </ul>
            {canPost ? (
                <form
                    className="space-y-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post(action, { preserveScroll: true, forceFormData: true, onSuccess: () => form.reset('body', 'upload') });
                    }}
                >
                    <textarea className="input min-h-24" value={form.data.body} onChange={(event) => form.setData('body', event.target.value)} placeholder="Write a note" aria-label="Comment" />
                    {form.errors.body ? <p className="text-xs text-clay-deep">{form.errors.body}</p> : null}
                    <div className="flex flex-wrap items-center gap-3">
                        {allowVisibility ? (
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={form.data.client_visible} onChange={(event) => form.setData('client_visible', event.target.checked)} />
                                Visible to the client
                            </label>
                        ) : null}
                        <input type="file" aria-label="Attach a file" onChange={(event) => form.setData('upload', event.target.files?.[0] ?? null)} />
                        <button type="submit" disabled={form.processing} className="rounded-full bg-clay px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                            {form.processing ? 'Posting…' : 'Post'}
                        </button>
                    </div>
                </form>
            ) : null}
        </div>
    );
}
