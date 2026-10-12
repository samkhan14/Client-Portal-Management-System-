import { Head, useForm } from '@inertiajs/react';
import { PortalLayout } from '@/Layouts/PortalLayout';
import { ActivityFeed } from '@/Components/ActivityFeed';
import { ApprovalDialog } from '@/Components/ApprovalDialog';
import { CommentThread } from '@/Components/CommentThread';
import { EmptyState } from '@/Components/EmptyState';
import { FileList } from '@/Components/FileList';
import { MilestoneList } from '@/Components/MilestoneList';
import { ProjectHeader } from '@/Components/ProjectHeader';
import { TaskTable } from '@/Components/TaskTable';
import { Badge } from '@/Components/Badge';
import { Field } from '@/Components/Field';
import type { Pager, TaskRow } from '@/types';

function ProjectPage(props: {
    project: {
        id: number;
        name: string;
        reference: string;
        description: string | null;
        scope: string | null;
        status: string;
        status_label: string;
        priority: string;
        priority_label: string;
        due_date: string | null;
        outstanding_request: string | null;
        agreed_fee: string | null;
        client: { name: string } | null;
        manager: { name: string } | null;
    };
    milestones: Array<{ id: number; name: string; description: string | null; due_date: string | null; total_tasks: number; done_tasks: number; complete: boolean }>;
    progress: number;
    tasks: Pager<TaskRow>;
    comments: Array<{ id: number; body: string; client_visible: boolean; created_at: string | null; author: string | null; file: { id: number; name: string } | null }>;
    files: Array<{ id: number; name: string; size: number; client_visible: boolean; uploaded_by: string | null }>;
    deliverables: Array<{ id: number; title: string; versions: Array<{ id: number; version_number: number; status: string; status_label: string; summary: string | null; decision_note: string | null }> }>;
    activities: Array<{ id: number; summary: string; actor: string | null; created_at: string | null; client_visible: boolean }>;
    change_requests: Array<{ id: number; title: string; status: string; status_label: string; description: string }>;
    invoices: Array<{ id: number; number: string; amount: string; status: string; status_label: string; due_on: string | null }>;
    can: { comment: boolean; upload: boolean; change_request: boolean; decide: boolean };
}) {
    const change = useForm({ title: '', description: '' });

    return (
        <>
            <Head title={props.project.name} />
            <ProjectHeader project={props.project} progress={props.progress} />
            {props.project.agreed_fee ? <p className="mt-4 text-sm">Agreed fee {props.project.agreed_fee}</p> : null}
            {props.project.description ? <p className="mt-3 max-w-3xl text-sm text-muted">{props.project.description}</p> : null}
            <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
                <section>
                    <h2 className="mb-3 font-display text-2xl">Milestones</h2>
                    <MilestoneList milestones={props.milestones} />
                </section>
                <section className="space-y-6">
                    <div className="rounded-3xl border border-line bg-card p-5">
                        <h2 className="mb-3 font-display text-2xl">Work you can see</h2>
                        <TaskTable tasks={props.tasks.data} />
                    </div>
                    <div className="rounded-3xl border border-line bg-card p-5">
                        <h2 className="mb-3 font-display text-2xl">For your review</h2>
                        {props.deliverables.length === 0 ? <EmptyState title="Nothing to review" body="Submitted deliverables will appear here. Drafts stay with the studio." /> : null}
                        {props.deliverables.map((deliverable) => (
                            <article key={deliverable.id} className="mb-4">
                                <h3 className="font-semibold">{deliverable.title}</h3>
                                <ul className="mt-2 space-y-2">
                                    {deliverable.versions.map((version) => (
                                        <li key={version.id} className="rounded-2xl bg-paper p-3 text-sm">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <span>Version {version.version_number}</span>
                                                <Badge value={version.status} label={version.status_label} />
                                            </div>
                                            {version.summary ? <p className="mt-2">{version.summary}</p> : null}
                                            {version.decision_note ? <p className="mt-1 text-muted">{version.decision_note}</p> : null}
                                            {props.can.decide && version.status === 'SUBMITTED' ? <div className="mt-3"><ApprovalDialog versionId={version.id} title={deliverable.title} /></div> : null}
                                        </li>
                                    ))}
                                </ul>
                            </article>
                        ))}
                    </div>
                    <div className="rounded-3xl border border-line bg-card p-5">
                        <h2 className="mb-3 font-display text-2xl">Conversation</h2>
                        <CommentThread comments={props.comments} action={`/portal/projects/${props.project.id}/comments`} allowVisibility={false} canPost={props.can.comment} />
                    </div>
                    <div className="rounded-3xl border border-line bg-card p-5">
                        <h2 className="mb-3 font-display text-2xl">Shared documents</h2>
                        <FileList files={props.files} uploadUrl={`/portal/projects/${props.project.id}/files`} canUpload={props.can.upload} showVisibility={false} />
                    </div>
                    <div className="rounded-3xl border border-line bg-card p-5">
                        <h2 className="mb-3 font-display text-2xl">Invoices</h2>
                        {props.invoices.length === 0 ? <EmptyState title="No shared invoices" body="Invoices the studio has shared with you will be listed here." /> : (
                            <ul className="space-y-2 text-sm">
                                {props.invoices.map((invoice) => <li key={invoice.id}>{invoice.number} · {invoice.amount} · {invoice.status_label}{invoice.due_on ? ` · due ${invoice.due_on}` : ''}</li>)}
                            </ul>
                        )}
                    </div>
                    <div className="rounded-3xl border border-line bg-card p-5">
                        <h2 className="mb-3 font-display text-2xl">Change requests</h2>
                        {props.change_requests.length === 0 ? <EmptyState title="No change requests" body="Ask for a change when the agreed scope needs to move." /> : (
                            <ul className="space-y-2 text-sm">
                                {props.change_requests.map((item) => <li key={item.id}><span className="font-semibold">{item.title}</span> · {item.status_label}<p>{item.description}</p></li>)}
                            </ul>
                        )}
                        {props.can.change_request ? (
                            <form className="mt-4 space-y-2" onSubmit={(event) => { event.preventDefault(); change.post(`/portal/projects/${props.project.id}/change-requests`, { preserveScroll: true, onSuccess: () => change.reset() }); }}>
                                <Field label="Ask for a change" error={change.errors.title}><input value={change.data.title} onChange={(event) => change.setData('title', event.target.value)} required /></Field>
                                <Field label="Detail" error={change.errors.description}><textarea value={change.data.description} onChange={(event) => change.setData('description', event.target.value)} required /></Field>
                                <button type="submit" disabled={change.processing} className="rounded-full bg-clay px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{change.processing ? 'Sending…' : 'Send request'}</button>
                            </form>
                        ) : null}
                    </div>
                    <div className="rounded-3xl border border-line bg-card p-5">
                        <h2 className="mb-3 font-display text-2xl">Recent activity</h2>
                        <ActivityFeed activities={props.activities} />
                    </div>
                </section>
            </div>
        </>
    );
}

ProjectPage.layout = (page: React.ReactNode) => <PortalLayout>{page}</PortalLayout>;
export default ProjectPage;
