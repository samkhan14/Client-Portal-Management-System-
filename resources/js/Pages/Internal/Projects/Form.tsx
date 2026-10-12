import { Head, useForm } from '@inertiajs/react';
import { InternalLayout } from '@/Layouts/InternalLayout';
import { Field } from '@/Components/Field';

type ProjectForm = {
    id?: number;
    name: string;
    reference: string;
    client_company_id: number | '';
    description: string;
    scope: string;
    project_manager_id: number | '';
    priority: string;
    start_date: string;
    due_date: string;
    budget: string;
    agreed_fee: string;
    fee_visible_to_client: boolean;
    outstanding_request?: string;
};

function FormPage({
    project,
    clients,
    managers,
    priorities,
}: {
    project: ProjectForm | null;
    clients: Array<{ id: number; name: string }>;
    managers: Array<{ id: number; name: string }>;
    priorities: Array<{ value: string; label: string }>;
}) {
    const form = useForm({
        name: project?.name ?? '',
        reference: project?.reference ?? '',
        client_company_id: project?.client_company_id ?? '',
        description: project?.description ?? '',
        scope: project?.scope ?? '',
        project_manager_id: project?.project_manager_id ?? '',
        priority: project?.priority ?? 'NORMAL',
        start_date: project?.start_date ?? '',
        due_date: project?.due_date ?? '',
        budget: project?.budget ?? '',
        agreed_fee: project?.agreed_fee ?? '',
        fee_visible_to_client: project?.fee_visible_to_client ?? false,
        outstanding_request: project?.outstanding_request ?? '',
        member_ids: [] as number[],
    });

    return (
        <>
            <Head title={project ? 'Edit project' : 'New project'} />
            <h1 className="mb-6 font-display text-4xl">{project ? 'Edit project' : 'Open a project'}</h1>
            <form
                className="grid gap-4 rounded-3xl border border-line bg-card p-6 md:grid-cols-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (project?.id) {
                        form.put(`/projects/${project.id}`);
                    } else {
                        form.post('/projects');
                    }
                }}
            >
                <Field label="Name" error={form.errors.name}><input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} required /></Field>
                <Field label="Reference" error={form.errors.reference}><input value={form.data.reference} onChange={(event) => form.setData('reference', event.target.value)} required /></Field>
                <Field label="Client" error={form.errors.client_company_id}>
                    <select value={form.data.client_company_id} onChange={(event) => form.setData('client_company_id', event.target.value ? Number(event.target.value) : '')} required>
                        <option value="">Choose</option>
                        {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                    </select>
                </Field>
                <Field label="Project manager" error={form.errors.project_manager_id}>
                    <select value={form.data.project_manager_id} onChange={(event) => form.setData('project_manager_id', event.target.value ? Number(event.target.value) : '')} required>
                        <option value="">Choose</option>
                        {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}
                    </select>
                </Field>
                <Field label="Priority" error={form.errors.priority}>
                    <select value={form.data.priority} onChange={(event) => form.setData('priority', event.target.value)}>
                        {priorities.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
                    </select>
                </Field>
                <Field label="Start" error={form.errors.start_date}><input type="date" value={form.data.start_date} onChange={(event) => form.setData('start_date', event.target.value)} /></Field>
                <Field label="Due" error={form.errors.due_date}><input type="date" value={form.data.due_date} onChange={(event) => form.setData('due_date', event.target.value)} /></Field>
                <Field label="Internal budget" error={form.errors.budget}><input inputMode="decimal" value={form.data.budget} onChange={(event) => form.setData('budget', event.target.value)} /></Field>
                <Field label="Agreed fee" error={form.errors.agreed_fee}><input inputMode="decimal" value={form.data.agreed_fee} onChange={(event) => form.setData('agreed_fee', event.target.value)} /></Field>
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                    <input type="checkbox" checked={form.data.fee_visible_to_client} onChange={(event) => form.setData('fee_visible_to_client', event.target.checked)} />
                    Show the agreed fee in the client portal
                </label>
                <Field label="Description" error={form.errors.description}><textarea className="min-h-24" value={form.data.description} onChange={(event) => form.setData('description', event.target.value)} /></Field>
                <Field label="Scope" error={form.errors.scope}><textarea className="min-h-24" value={form.data.scope} onChange={(event) => form.setData('scope', event.target.value)} /></Field>
                {project ? (
                    <Field label="Outstanding client request" error={form.errors.outstanding_request}>
                        <textarea className="min-h-20 md:col-span-2" value={form.data.outstanding_request} onChange={(event) => form.setData('outstanding_request', event.target.value)} />
                    </Field>
                ) : null}
                <div className="md:col-span-2">
                    <button type="submit" disabled={form.processing} className="rounded-full bg-clay px-5 py-2.5 font-semibold text-white disabled:opacity-50">
                        {form.processing ? 'Saving…' : 'Save project'}
                    </button>
                </div>
            </form>
        </>
    );
}

FormPage.layout = (page: React.ReactNode) => <InternalLayout>{page}</InternalLayout>;

export default FormPage;
