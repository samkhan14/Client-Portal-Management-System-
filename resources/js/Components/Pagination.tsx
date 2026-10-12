import { router } from '@inertiajs/react';

export function Pagination({ page, last, total, path }: { page: number; last: number; total: number; path?: string }) {
    if (last <= 1) {
        return <p className="text-sm text-muted">{total} total</p>;
    }

    const go = (next: number) => {
        const params = new URLSearchParams(window.location.search);
        params.set('page', String(next));
        router.get(`${path ?? window.location.pathname}?${params.toString()}`, {}, { preserveState: true, preserveScroll: true });
    };

    return (
        <div className="flex items-center justify-between gap-3 text-sm">
            <p className="text-muted">{total} total</p>
            <div className="flex gap-2">
                <button type="button" className="rounded-full border border-line px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => go(page - 1)}>
                    Previous
                </button>
                <span className="px-2 py-1 text-muted">
                    {page} / {last}
                </span>
                <button type="button" className="rounded-full border border-line px-3 py-1 disabled:opacity-40" disabled={page >= last} onClick={() => go(page + 1)}>
                    Next
                </button>
            </div>
        </div>
    );
}
