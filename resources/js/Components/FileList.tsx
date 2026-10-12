import { router, useForm } from '@inertiajs/react';
import { EmptyState } from '@/Components/EmptyState';

type FileRow = {
    id: number;
    name: string;
    size: number;
    client_visible: boolean;
    uploaded_by: string | null;
};

export function FileList({ files, uploadUrl, canUpload, showVisibility }: { files: FileRow[]; uploadUrl?: string; canUpload: boolean; showVisibility: boolean }) {
    const form = useForm({ upload: null as File | null, client_visible: false });

    return (
        <div className="space-y-4">
            {files.length === 0 ? <EmptyState title="No files" body="Shared documents appear here after an authorized upload." /> : null}
            <ul className="divide-y divide-line">
                {files.map((file) => (
                    <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                        <div>
                            <a className="font-semibold break-all text-teal" href={`/files/${file.id}/download`}>
                                {file.name}
                            </a>
                            <p className="text-xs text-muted">
                                {file.uploaded_by ?? 'Unknown'} · {Math.ceil(file.size / 1024)} KB
                                {showVisibility ? ` · ${file.client_visible ? 'client visible' : 'staff only'}` : ''}
                            </p>
                        </div>
                        {showVisibility ? (
                            <button type="button" className="text-xs text-clay" onClick={() => router.delete(`/files/${file.id}`, { preserveScroll: true })}>
                                Remove
                            </button>
                        ) : null}
                    </li>
                ))}
            </ul>
            {canUpload && uploadUrl ? (
                <form
                    className="flex flex-wrap items-center gap-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post(uploadUrl, { forceFormData: true, preserveScroll: true, onSuccess: () => form.reset() });
                    }}
                >
                    <input type="file" aria-label="Upload a file" required onChange={(event) => form.setData('upload', event.target.files?.[0] ?? null)} />
                    {showVisibility ? (
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={form.data.client_visible} onChange={(event) => form.setData('client_visible', event.target.checked)} />
                            Share with client
                        </label>
                    ) : null}
                    <button type="submit" disabled={form.processing || !form.data.upload} className="rounded-full bg-pine px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">
                        {form.processing ? 'Uploading…' : 'Upload'}
                    </button>
                    {form.errors.upload ? <span className="text-xs text-clay-deep">{form.errors.upload}</span> : null}
                </form>
            ) : null}
        </div>
    );
}
