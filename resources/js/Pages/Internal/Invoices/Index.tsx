import { Head, useForm, usePage } from '@inertiajs/react';
import { InternalLayout } from '@/Layouts/InternalLayout';
import { Badge } from '@/Components/Badge';
import { EmptyState } from '@/Components/EmptyState';
import { Field } from '@/Components/Field';
import { Pagination } from '@/Components/Pagination';
import type { Pager, SharedProps } from '@/types';

type InvoiceRow = {
    id: number;
    number: string;
    project: string | null;
    project_id: number;
    amount: string;
    amount_value: string;
    status: string;
    status_label: string;
    client_visible: boolean;
    issued_on: string | null;
    due_on: string | null;
    notes: string | null;
    internal_notes: string | null;
};

function Index({ invoices, projects, can_manage }: { invoices: Pager<InvoiceRow>; projects: Array<{ id: number; name: string }>; can_manage: boolean }) {
    const form = useForm({ project_id: projects[0]?.id ?? '', number: '', amount: '', status: 'UNPAID', client_visible: true, issued_on: '', due_on: '', notes: '', internal_notes: '' });
    const { abilities } = usePage<SharedProps>().props;

    return (
        <>
            <Head title="Invoices" />
            <h1 className="mb-6 font-display text-4xl">Invoices</h1>
            {invoices.data.length === 0 ? <EmptyState title="No invoices" body="Record an invoice when the studio is ready to bill a project." /> : (
            <ul className="divide-y divide-line rounded-3xl border border-line bg-card">
                {invoices.data.map((invoice) => (
                    <li key={invoice.id} className="px-5 py-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold">{invoice.number} · {invoice.amount}</p>
                            <Badge value={invoice.status} label={invoice.status_label} />
                        </div>
                        <p className="text-muted">{invoice.project}{invoice.client_visible ? ' · visible to client' : ' · internal'}{invoice.issued_on ? ` · issued ${invoice.issued_on}` : ''}</p>
                        {invoice.internal_notes && abilities.invoice ? <p className="mt-1 text-xs text-muted">Internal: {invoice.internal_notes}</p> : null}
                    </li>
                ))}
            </ul>
            )}
            <div className="mt-4"><Pagination page={invoices.current_page} last={invoices.last_page} total={invoices.total} /></div>
            {can_manage ? (
                <form className="mt-8 grid gap-3 rounded-3xl border border-line bg-card p-5 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); form.post('/invoices', { preserveScroll: true, onSuccess: () => form.reset('number', 'amount', 'notes', 'internal_notes') }); }}>
                    <Field label="Project" error={form.errors.project_id}>
                        <select value={form.data.project_id} onChange={(event) => form.setData('project_id', Number(event.target.value))}>
                            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                        </select>
                    </Field>
                    <Field label="Number" error={form.errors.number}><input value={form.data.number} onChange={(event) => form.setData('number', event.target.value)} required /></Field>
                    <Field label="Amount" error={form.errors.amount}><input value={form.data.amount} onChange={(event) => form.setData('amount', event.target.value)} required /></Field>
                    <Field label="Status" error={form.errors.status}>
                        <select value={form.data.status} onChange={(event) => form.setData('status', event.target.value)}>
                            <option value="UNPAID">Unpaid</option>
                            <option value="PAID">Paid</option>
                            <option value="VOID">Void</option>
                        </select>
                    </Field>
                    <Field label="Issued" error={form.errors.issued_on}><input type="date" value={form.data.issued_on} onChange={(event) => form.setData('issued_on', event.target.value)} required /></Field>
                    <Field label="Due" error={form.errors.due_on}><input type="date" value={form.data.due_on} onChange={(event) => form.setData('due_on', event.target.value)} /></Field>
                    <Field label="Client note" error={form.errors.notes}><input value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} /></Field>
                    <Field label="Internal note" error={form.errors.internal_notes}><input value={form.data.internal_notes} onChange={(event) => form.setData('internal_notes', event.target.value)} /></Field>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.data.client_visible} onChange={(event) => form.setData('client_visible', event.target.checked)} /> Visible to the client</label>
                    <button type="submit" disabled={form.processing} className="rounded-full bg-clay px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{form.processing ? 'Saving…' : 'Record invoice'}</button>
                </form>
            ) : null}
        </>
    );
}

Index.layout = (page: React.ReactNode) => <InternalLayout>{page}</InternalLayout>;
export default Index;
