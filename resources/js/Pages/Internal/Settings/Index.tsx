import { Head, useForm } from '@inertiajs/react';
import { InternalLayout } from '@/Layouts/InternalLayout';
import { Field } from '@/Components/Field';

function Index({ organization }: { organization: { name: string; slug: string; hourly_rate: string; timezone: string } }) {
    const form = useForm({ name: organization.name, hourly_rate: organization.hourly_rate, timezone: organization.timezone });

    return (
        <>
            <Head title="Agency settings" />
            <h1 className="mb-2 font-display text-4xl">Agency settings</h1>
            <p className="mb-6 text-sm text-muted">Slug {organization.slug}. The hourly rate is internal and drives project margin.</p>
            <form className="grid max-w-xl gap-4 rounded-3xl border border-line bg-card p-6" onSubmit={(event) => { event.preventDefault(); form.put('/settings'); }}>
                <Field label="Name" error={form.errors.name}><input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} required /></Field>
                <Field label="Hourly rate (USD)" error={form.errors.hourly_rate}><input value={form.data.hourly_rate} onChange={(event) => form.setData('hourly_rate', event.target.value)} required /></Field>
                <Field label="Timezone" error={form.errors.timezone}><input value={form.data.timezone} onChange={(event) => form.setData('timezone', event.target.value)} required /></Field>
                <button type="submit" disabled={form.processing} className="rounded-full bg-pine px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">{form.processing ? 'Saving…' : 'Save settings'}</button>
            </form>
        </>
    );
}

Index.layout = (page: React.ReactNode) => <InternalLayout>{page}</InternalLayout>;
export default Index;
