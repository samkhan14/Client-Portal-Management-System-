import { Head, Link, useForm } from '@inertiajs/react';
import { InternalLayout } from '@/Layouts/InternalLayout';
import { EmptyState } from '@/Components/EmptyState';
import { Field } from '@/Components/Field';

function Index({ companies }: { companies: Array<{ id: number; name: string; website: string | null; projects_count: number; contacts_count: number; onboarding_items_count: number }> }) {
    const form = useForm({ name: '', slug: '', website: '', notes: '' });

    return (
        <>
            <Head title="Clients" />
            <h1 className="mb-6 font-display text-4xl">Client companies</h1>
            {companies.length === 0 ? <EmptyState title="No clients yet" body="Add the first company to start onboarding." /> : (
                <ul className="space-y-3">
                    {companies.map((company) => (
                        <li key={company.id}>
                            <Link href={`/clients/${company.id}`} className="block rounded-3xl border border-line bg-card p-5">
                                <h2 className="font-display text-2xl">{company.name}</h2>
                                <p className="text-sm text-muted">{company.projects_count} projects · {company.contacts_count} contacts · {company.onboarding_items_count} onboarding items</p>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            <form className="mt-8 grid gap-3 rounded-3xl border border-line bg-card p-5 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); form.post('/clients'); }}>
                <Field label="Company" error={form.errors.name}><input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} required /></Field>
                <Field label="Slug" error={form.errors.slug}><input value={form.data.slug} onChange={(event) => form.setData('slug', event.target.value)} required /></Field>
                <Field label="Website" error={form.errors.website}><input value={form.data.website} onChange={(event) => form.setData('website', event.target.value)} /></Field>
                <Field label="Internal notes" error={form.errors.notes}><input value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} /></Field>
                <button type="submit" disabled={form.processing} className="rounded-full bg-clay px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Add company</button>
            </form>
        </>
    );
}

Index.layout = (page: React.ReactNode) => <InternalLayout>{page}</InternalLayout>;
export default Index;
