import { Head, Link, router, useForm } from '@inertiajs/react';
import { InternalLayout } from '@/Layouts/InternalLayout';
import { Badge } from '@/Components/Badge';
import { EmptyState } from '@/Components/EmptyState';
import { Field } from '@/Components/Field';

type Company = {
    id: number;
    name: string;
    slug: string;
    website: string | null;
    notes: string | null;
    contacts: Array<{ id: number; name: string; email: string | null; phone: string | null; title: string | null }>;
    onboarding: Array<{ id: number; title: string; detail: string | null; is_complete: boolean }>;
    projects: Array<{ id: number; name: string; reference: string; status: string; status_label: string }>;
};

function Show({ company }: { company: Company }) {
    const contact = useForm({ name: '', email: '', phone: '', title: '' });
    const item = useForm({ title: '', detail: '' });

    return (
        <>
            <Head title={company.name} />
            <p className="text-xs uppercase tracking-[0.16em] text-teal">{company.slug}</p>
            <h1 className="font-display text-4xl">{company.name}</h1>
            {company.website ? <p className="text-sm text-muted">{company.website}</p> : null}
            {company.notes ? <p className="mt-3 max-w-2xl text-sm">{company.notes}</p> : null}
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <section className="rounded-3xl border border-line bg-card p-5">
                    <h2 className="font-display text-2xl">Contacts</h2>
                    {company.contacts.length === 0 ? <div className="mt-3"><EmptyState title="No contacts" body="Add the people at this company who the studio works with." /></div> : (
                    <ul className="mt-3 space-y-2 text-sm">
                        {company.contacts.map((person) => (
                            <li key={person.id} className="flex justify-between gap-3">
                                <span>{person.name}{person.title ? `, ${person.title}` : ''} · {person.email}</span>
                                <button type="button" className="text-xs text-clay" onClick={() => router.delete(`/contacts/${person.id}`, { preserveScroll: true })}>Remove</button>
                            </li>
                        ))}
                    </ul>
                    )}
                    <form className="mt-4 grid gap-2" onSubmit={(event) => { event.preventDefault(); contact.post(`/clients/${company.id}/contacts`, { preserveScroll: true, onSuccess: () => contact.reset() }); }}>
                        <Field label="Name" error={contact.errors.name}><input value={contact.data.name} onChange={(event) => contact.setData('name', event.target.value)} required /></Field>
                        <Field label="Email" error={contact.errors.email}><input type="email" value={contact.data.email} onChange={(event) => contact.setData('email', event.target.value)} /></Field>
                        <button type="submit" disabled={contact.processing} className="rounded-full bg-pine px-3 py-1.5 text-sm text-paper disabled:opacity-50">Add contact</button>
                    </form>
                </section>
                <section className="rounded-3xl border border-line bg-card p-5">
                    <h2 className="font-display text-2xl">Onboarding</h2>
                    {company.onboarding.length === 0 ? <div className="mt-3"><EmptyState title="Checklist is empty" body="Add the steps this client still needs to finish." /></div> : (
                    <ul className="mt-3 space-y-2">
                        {company.onboarding.map((step) => (
                            <li key={step.id}>
                                <button type="button" className="text-left text-sm" onClick={() => router.post(`/onboarding/${step.id}/toggle`, {}, { preserveScroll: true })}>
                                    <span className={step.is_complete ? 'text-teal' : ''}>{step.is_complete ? 'Done' : 'Open'}</span> · {step.title}
                                </button>
                            </li>
                        ))}
                    </ul>
                    )}
                    <form className="mt-4 grid gap-2" onSubmit={(event) => { event.preventDefault(); item.post(`/clients/${company.id}/onboarding`, { preserveScroll: true, onSuccess: () => item.reset() }); }}>
                        <Field label="Checklist item" error={item.errors.title}><input value={item.data.title} onChange={(event) => item.setData('title', event.target.value)} required /></Field>
                        <button type="submit" disabled={item.processing} className="rounded-full bg-clay px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Add item</button>
                    </form>
                </section>
            </div>
            <section className="mt-6">
                <h2 className="font-display text-2xl">Projects</h2>
                <ul className="mt-3 space-y-2">
                    {company.projects.map((project) => (
                        <li key={project.id}>
                            <Link href={`/projects/${project.id}`} className="flex items-center gap-3 text-sm">
                                <span>{project.reference} · {project.name}</span>
                                <Badge value={project.status} label={project.status_label} />
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>
        </>
    );
}

Show.layout = (page: React.ReactNode) => <InternalLayout>{page}</InternalLayout>;
export default Show;
