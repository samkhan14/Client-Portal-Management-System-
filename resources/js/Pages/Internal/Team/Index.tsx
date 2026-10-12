import { Head, router, useForm, usePage } from '@inertiajs/react';
import { InternalLayout } from '@/Layouts/InternalLayout';
import { EmptyState } from '@/Components/EmptyState';
import { Field } from '@/Components/Field';
import type { SharedProps } from '@/types';

type Member = { id: number; user_id: number; name: string; email: string; role: string; role_label: string; client: string | null; client_company_id: number | null };
type Invite = { id: number; email: string; role_label: string; usable: boolean; accepted_at: string | null; revoked_at: string | null };

function Index({
    members,
    invitations,
    queued_messages,
    roles,
    clients,
}: {
    members: Member[];
    invitations: Invite[];
    queued_messages: Array<{ id: number; email: string; subject: string; status: string }>;
    roles: Array<{ value: string; label: string }>;
    clients: Array<{ id: number; name: string }>;
}) {
    const form = useForm({ email: '', role: roles[0]?.value ?? 'TEAM_MEMBER', client_company_id: '' as number | '' });
    const clientRole = form.data.role.startsWith('CLIENT') || form.data.role === 'READ_ONLY';
    const currentUserId = usePage<SharedProps>().props.auth.user?.id;

    return (
        <>
            <Head title="People" />
            <h1 className="mb-2 font-display text-4xl">People</h1>
            <p className="mb-6 max-w-2xl text-sm text-muted">Invitations use a single-use link. The response is the same whether or not that email already belongs to the agency.</p>
            <ul className="divide-y divide-line rounded-3xl border border-line bg-card">
                {members.map((member) => (
                    <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                        <div>
                            <p className="font-semibold">{member.name}</p>
                            <p className="text-sm text-muted">{member.email} · {member.role_label}{member.client ? ` · ${member.client}` : ''}</p>
                        </div>
                        {member.user_id !== currentUserId ? <button type="button" className="text-xs text-clay" onClick={() => router.delete(`/memberships/${member.id}`, { preserveScroll: true })}>Remove</button> : null}
                    </li>
                ))}
            </ul>
            <form className="mt-6 grid gap-3 rounded-3xl border border-line bg-card p-5 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); form.post('/invitations', { preserveScroll: true, onSuccess: () => form.reset('email') }); }}>
                <Field label="Email" error={form.errors.email}><input type="email" value={form.data.email} onChange={(event) => form.setData('email', event.target.value)} required /></Field>
                <Field label="Role" error={form.errors.role}>
                    <select value={form.data.role} onChange={(event) => form.setData('role', event.target.value)}>
                        {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                    </select>
                </Field>
                {clientRole ? (
                    <Field label="Client company" error={form.errors.client_company_id}>
                        <select value={form.data.client_company_id} onChange={(event) => form.setData('client_company_id', event.target.value ? Number(event.target.value) : '')}>
                            <option value="">Choose</option>
                            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                        </select>
                    </Field>
                ) : null}
                <button type="submit" disabled={form.processing} className="rounded-full bg-clay px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2">{form.processing ? 'Sending…' : 'Issue invitation'}</button>
            </form>
            <h2 className="mt-8 font-display text-2xl">Invitations</h2>
            {invitations.length === 0 ? <div className="mt-3"><EmptyState title="No invitations yet" body="Issue an invitation above. The same confirmation is shown whether or not that email already has an account." /></div> : (
            <ul className="mt-3 space-y-2 text-sm">
                {invitations.map((invitation) => (
                    <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line px-4 py-3">
                        <span>{invitation.email} · {invitation.role_label} · {invitation.usable ? 'open' : invitation.accepted_at ? 'accepted' : 'closed'}</span>
                        {invitation.usable ? <button type="button" className="text-xs text-clay" onClick={() => router.post(`/invitations/${invitation.id}/revoke`, {}, { preserveScroll: true })}>Revoke</button> : null}
                    </li>
                ))}
            </ul>
            )}
            {queued_messages.length > 0 ? (
                <section className="mt-8">
                    <h2 className="font-display text-2xl">Queued mail</h2>
                    <p className="text-sm text-muted">No live SMTP. These rows are the messages that would be emailed.</p>
                    <ul className="mt-3 space-y-2 text-sm">
                        {queued_messages.map((message) => <li key={message.id}>{message.status} · {message.email} · {message.subject}</li>)}
                    </ul>
                </section>
            ) : null}
        </>
    );
}

Index.layout = (page: React.ReactNode) => <InternalLayout>{page}</InternalLayout>;
export default Index;
