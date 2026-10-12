import { Head, router } from '@inertiajs/react';

export default function Organizations({ organizations }: { organizations: Array<{ id: number; name: string; slug: string }> }) {
    return (
        <main className="mx-auto max-w-3xl px-6 py-10">
            <Head title="Organizations" />
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Platform</p>
                    <h1 className="font-display text-4xl">Agencies</h1>
                </div>
                <button type="button" className="rounded-full border border-line px-3 py-1.5 text-sm" onClick={() => router.post('/logout')}>Sign out</button>
            </div>
            {organizations.length === 0 ? <p className="text-sm text-muted">No agencies yet.</p> : null}
            <ul className="divide-y divide-line rounded-3xl border border-line bg-card">
                {organizations.map((organization) => (
                    <li key={organization.id} className="px-5 py-4">
                        <p className="font-semibold">{organization.name}</p>
                        <p className="text-sm text-muted">{organization.slug}</p>
                    </li>
                ))}
            </ul>
        </main>
    );
}
