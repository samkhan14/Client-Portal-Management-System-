export function EmptyState({ title, body }: { title: string; body: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-line bg-card px-6 py-10 text-center">
            <p className="font-display text-xl text-ink">{title}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
        </div>
    );
}
