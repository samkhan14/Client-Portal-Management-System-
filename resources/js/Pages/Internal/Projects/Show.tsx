import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { InternalLayout } from '@/Layouts/InternalLayout';
import { ActivityFeed } from '@/Components/ActivityFeed';
import { CommentThread } from '@/Components/CommentThread';
import { FileList } from '@/Components/FileList';
import { MilestoneList } from '@/Components/MilestoneList';
import { Pagination } from '@/Components/Pagination';
import { ProjectHeader } from '@/Components/ProjectHeader';
import { TaskBoard } from '@/Components/TaskBoard';
import { TaskTable } from '@/Components/TaskTable';
import { Field } from '@/Components/Field';
import type { Pager, TaskRow } from '@/types';

type Version = {
    id: number;
    version_number: number;
    status: string;
    status_label: string;
    summary: string | null;
    decision_note: string | null;
    decided_by: string | null;
};

type ShowProps = {
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
        start_date: string | null;
        due_date: string | null;
        outstanding_request: string | null;
        client: { id: number; name: string } | null;
        manager: { id: number; name: string } | null;
        budget?: string | null;
        agreed_fee?: string | null;
        time_minutes?: number;
        cost?: string | null;
        margin?: string | null;
    };
    milestones: Array<{ id: number; name: string; description: string | null; due_date: string | null; total_tasks: number; done_tasks: number; complete: boolean }>;
    progress: number;
    tasks: Pager<TaskRow>;
    board: Record<string, TaskRow[]> | null;
    comments: Array<{ id: number; body: string; client_visible: boolean; created_at: string | null; author: string | null; file: { id: number; name: string } | null }>;
    files: Array<{ id: number; name: string; size: number; client_visible: boolean; uploaded_by: string | null }>;
    deliverables: Array<{ id: number; title: string; description: string | null; versions: Version[] }>;
    activities: Array<{ id: number; summary: string; actor: string | null; created_at: string | null; client_visible: boolean }>;
    time_entries: Array<{ id: number; minutes: number; work_date: string | null; note: string | null; user: string | null; task: string | null }>;
    change_requests: Array<{ id: number; title: string; description: string; status: string; status_label: string; decision_note: string | null; requester: string | null }>;
    invoices: Array<{ id: number; number: string; amount: string; status: string; status_label: string; client_visible: boolean }>;
    members: Array<{ id: number; name: string; email: string }>;
    can: { update: boolean; transition: boolean; manage_members: boolean; financials: boolean; create_task: boolean; draft_deliverable: boolean };
};

const projectMoves: Record<string, string[]> = {
    PLANNING: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
    IN_PROGRESS: ['WAITING_ON_CLIENT', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
    WAITING_ON_CLIENT: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
    ON_HOLD: ['PLANNING', 'IN_PROGRESS', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
};

function Show(props: ShowProps) {
    const { project, can } = props;
    const [tab, setTab] = useState<'work' | 'review' | 'files' | 'money'>('work');
    const taskForm = useForm({
        title: '',
        description: '',
        assignee_id: '' as number | '',
        milestone_id: '' as number | '',
        parent_id: '' as number | '',
        prerequisite_task_id: '' as number | '',
        priority: 'NORMAL',
        due_date: '',
        estimate_hours: '',
        client_visible: false,
    });
    const milestoneForm = useForm({ name: '', description: '', due_date: '' });
    const deliverableForm = useForm({ title: '', description: '', summary: '' });
    const statusForm = useForm({ status: projectMoves[project.status]?.[0] ?? '', outstanding_request: project.outstanding_request ?? '' });
    const timeForm = useForm({ minutes: 60, work_date: '', note: '', task_id: '' as number | '' });
    const memberForm = useForm({ member_ids: props.members.map((member) => member.id) });

    return (
        <>
            <Head title={project.name} />
            <ProjectHeader project={project} progress={props.progress} />
            <div className="mt-4 flex flex-wrap gap-2">
                {can.update ? <Link href={`/projects/${project.id}/edit`} className="rounded-full border border-line px-3 py-1.5 text-sm">Edit</Link> : null}
                <Link href={`/projects/${project.id}?view=board`} className="rounded-full border border-line px-3 py-1.5 text-sm" preserveScroll>Board</Link>
                <Link href={`/projects/${project.id}`} className="rounded-full border border-line px-3 py-1.5 text-sm" preserveScroll>List</Link>
            </div>
            {project.description ? <p className="mt-4 max-w-3xl text-sm text-muted">{project.description}</p> : null}
            {project.scope ? <p className="mt-2 max-w-3xl text-sm">Scope: {project.scope}</p> : null}
            {can.financials ? (
                <p className="mt-3 text-sm text-muted">
                    Budget {project.budget ?? '—'} · Fee {project.agreed_fee ?? '—'} · Time {project.time_minutes ?? 0} min · Cost {project.cost} · Margin {project.margin}
                </p>
            ) : null}
            {can.transition ? (
                <form
                    className="mt-4 flex flex-wrap items-end gap-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        statusForm.post(`/projects/${project.id}/status`, { preserveScroll: true });
                    }}
                >
                    <Field label="Move status" error={statusForm.errors.status}>
                        <select value={statusForm.data.status} onChange={(event) => statusForm.setData('status', event.target.value)}>
                            {(projectMoves[project.status] ?? []).map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                        </select>
                    </Field>
                    {statusForm.data.status === 'WAITING_ON_CLIENT' ? (
                        <Field label="What the client needs to do" error={statusForm.errors.outstanding_request}>
                            <input value={statusForm.data.outstanding_request} onChange={(event) => statusForm.setData('outstanding_request', event.target.value)} />
                        </Field>
                    ) : null}
                    <button type="submit" disabled={statusForm.processing || (projectMoves[project.status] ?? []).length === 0} className="rounded-full bg-pine px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">
                        Update status
                    </button>
                </form>
            ) : null}
            <div className="mt-6 flex gap-2" role="tablist">
                {(['work', 'review', 'files', 'money'] as const).map((item) => (
                    <button key={item} type="button" role="tab" aria-selected={tab === item} className={`rounded-full px-3 py-1.5 text-sm ${tab === item ? 'bg-teal text-white' : 'border border-line'}`} onClick={() => setTab(item)}>
                        {item}
                    </button>
                ))}
            </div>
            {tab === 'work' ? (
                <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
                    <section className="space-y-4">
                        <h2 className="font-display text-2xl">Milestones</h2>
                        <MilestoneList milestones={props.milestones} />
                        {can.update ? (
                            <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); milestoneForm.post(`/projects/${project.id}/milestones`, { preserveScroll: true, onSuccess: () => milestoneForm.reset() }); }}>
                                <input className="input" placeholder="Milestone name" aria-label="Milestone name" value={milestoneForm.data.name} onChange={(event) => milestoneForm.setData('name', event.target.value)} required />
                                <input className="input" type="date" aria-label="Milestone due date" value={milestoneForm.data.due_date} onChange={(event) => milestoneForm.setData('due_date', event.target.value)} />
                                <button type="submit" disabled={milestoneForm.processing} className="rounded-full bg-clay px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Add milestone</button>
                            </form>
                        ) : null}
                    </section>
                    <section className="rounded-3xl border border-line bg-card p-5">
                        <h2 className="mb-4 font-display text-2xl">Tasks</h2>
                        {props.board ? <TaskBoard board={props.board} projectId={project.id} manage={can.update} /> : <TaskTable tasks={props.tasks.data} projectId={project.id} manage={can.update} />}
                        <div className="mt-4"><Pagination page={props.tasks.current_page} last={props.tasks.last_page} total={props.tasks.total} /></div>
                        {can.create_task ? (
                            <form className="mt-6 grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); taskForm.post(`/projects/${project.id}/tasks`, { preserveScroll: true, onSuccess: () => taskForm.reset('title', 'description') }); }}>
                                <Field label="New task" error={taskForm.errors.title}><input value={taskForm.data.title} onChange={(event) => taskForm.setData('title', event.target.value)} required /></Field>
                                <Field label="Assignee" error={taskForm.errors.assignee_id}>
                                    <select value={taskForm.data.assignee_id} onChange={(event) => taskForm.setData('assignee_id', event.target.value ? Number(event.target.value) : '')}>
                                        <option value="">Unassigned</option>
                                        {props.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                                    </select>
                                </Field>
                                <Field label="Milestone" error={taskForm.errors.milestone_id}>
                                    <select value={taskForm.data.milestone_id} onChange={(event) => taskForm.setData('milestone_id', event.target.value ? Number(event.target.value) : '')}>
                                        <option value="">None</option>
                                        {props.milestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.name}</option>)}
                                    </select>
                                </Field>
                                <Field label="Parent task" error={taskForm.errors.parent_id}>
                                    <select value={taskForm.data.parent_id} onChange={(event) => taskForm.setData('parent_id', event.target.value ? Number(event.target.value) : '')}>
                                        <option value="">None</option>
                                        {props.tasks.data.filter((task) => !task.parent_id).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                                    </select>
                                </Field>
                                <Field label="Prerequisite" error={taskForm.errors.prerequisite_task_id}>
                                    <select value={taskForm.data.prerequisite_task_id} onChange={(event) => taskForm.setData('prerequisite_task_id', event.target.value ? Number(event.target.value) : '')}>
                                        <option value="">None</option>
                                        {props.tasks.data.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                                    </select>
                                </Field>
                                <Field label="Due" error={taskForm.errors.due_date}><input type="date" value={taskForm.data.due_date} onChange={(event) => taskForm.setData('due_date', event.target.value)} /></Field>
                                <Field label="Estimate hours" error={taskForm.errors.estimate_hours}><input value={taskForm.data.estimate_hours} onChange={(event) => taskForm.setData('estimate_hours', event.target.value)} /></Field>
                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={taskForm.data.client_visible} onChange={(event) => taskForm.setData('client_visible', event.target.checked)} /> Client can see this task</label>
                                <button type="submit" disabled={taskForm.processing} className="rounded-full bg-clay px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{taskForm.processing ? 'Adding…' : 'Add task'}</button>
                            </form>
                        ) : null}
                    </section>
                </div>
            ) : null}
            {tab === 'review' ? (
                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <section className="rounded-3xl border border-line bg-card p-5">
                        <h2 className="mb-4 font-display text-2xl">Deliverables</h2>
                        {props.deliverables.map((deliverable) => (
                            <article key={deliverable.id} className="mb-4 rounded-2xl bg-paper p-4">
                                <h3 className="font-semibold">{deliverable.title}</h3>
                                <ul className="mt-2 space-y-2 text-sm">
                                    {deliverable.versions.map((version) => (
                                        <li key={version.id} className="rounded-xl border border-line bg-card p-3">
                                            <p>Version {version.version_number} · {version.status_label}</p>
                                            {version.summary ? <p className="text-muted">{version.summary}</p> : null}
                                            {version.decision_note ? <p>Decision by {version.decided_by}: {version.decision_note}</p> : null}
                                            {version.status === 'DRAFT' && can.draft_deliverable ? (
                                                <button type="button" className="mt-2 text-xs font-semibold text-clay" onClick={() => router.post(`/deliverable-versions/${version.id}/submit`, {}, { preserveScroll: true })}>Submit for review</button>
                                            ) : null}
                                        </li>
                                    ))}
                                </ul>
                                {can.draft_deliverable ? (
                                    <button type="button" className="mt-2 text-sm font-semibold text-teal" onClick={() => router.post(`/projects/${project.id}/deliverables/${deliverable.id}/versions`, {}, { preserveScroll: true })}>Open next version</button>
                                ) : null}
                            </article>
                        ))}
                        {can.draft_deliverable ? (
                            <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); deliverableForm.post(`/projects/${project.id}/deliverables`, { preserveScroll: true, onSuccess: () => deliverableForm.reset() }); }}>
                                <input className="input" placeholder="Deliverable title" aria-label="Deliverable title" value={deliverableForm.data.title} onChange={(event) => deliverableForm.setData('title', event.target.value)} required />
                                <textarea className="input" placeholder="Draft summary" aria-label="Draft summary" value={deliverableForm.data.summary} onChange={(event) => deliverableForm.setData('summary', event.target.value)} />
                                <button type="submit" disabled={deliverableForm.processing} className="rounded-full bg-pine px-3 py-1.5 text-sm text-paper disabled:opacity-50">Start draft</button>
                            </form>
                        ) : null}
                    </section>
                    <section className="space-y-6">
                        <div className="rounded-3xl border border-line bg-card p-5">
                            <h2 className="mb-4 font-display text-2xl">Comments</h2>
                            <CommentThread comments={props.comments} action={`/projects/${project.id}/comments`} allowVisibility canPost />
                        </div>
                        <div className="rounded-3xl border border-line bg-card p-5">
                            <h2 className="mb-4 font-display text-2xl">Activity</h2>
                            <ActivityFeed activities={props.activities} />
                        </div>
                    </section>
                </div>
            ) : null}
            {tab === 'files' ? (
                <section className="mt-6 rounded-3xl border border-line bg-card p-5">
                    <h2 className="mb-4 font-display text-2xl">Files</h2>
                    <FileList files={props.files} uploadUrl={`/projects/${project.id}/files`} canUpload={can.draft_deliverable || can.create_task || can.update} showVisibility />
                </section>
            ) : null}
            {tab === 'money' ? (
                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <section className="rounded-3xl border border-line bg-card p-5">
                        <h2 className="font-display text-2xl">Time</h2>
                        <ul className="mt-3 space-y-2 text-sm">
                            {props.time_entries.map((entry) => (
                                <li key={entry.id}>{entry.work_date} · {entry.user} · {entry.minutes} min {entry.task ? `· ${entry.task}` : ''} {entry.note ? `· ${entry.note}` : ''}</li>
                            ))}
                        </ul>
                        <form className="mt-4 grid gap-2" onSubmit={(event) => { event.preventDefault(); timeForm.post(`/projects/${project.id}/time-entries`, { preserveScroll: true, onSuccess: () => timeForm.reset('note') }); }}>
                            <input className="input" type="number" min={1} aria-label="Minutes" value={timeForm.data.minutes} onChange={(event) => timeForm.setData('minutes', Number(event.target.value))} />
                            <input className="input" type="date" aria-label="Work date" required value={timeForm.data.work_date} onChange={(event) => timeForm.setData('work_date', event.target.value)} />
                            <input className="input" placeholder="Note" aria-label="Time note" value={timeForm.data.note} onChange={(event) => timeForm.setData('note', event.target.value)} />
                            <button type="submit" disabled={timeForm.processing} className="rounded-full bg-pine px-3 py-1.5 text-sm text-paper disabled:opacity-50">Log time</button>
                        </form>
                    </section>
                    <section className="rounded-3xl border border-line bg-card p-5">
                        <h2 className="font-display text-2xl">Invoices and changes</h2>
                        <ul className="mt-3 space-y-2 text-sm">
                            {props.invoices.map((invoice) => <li key={invoice.id}>{invoice.number} · {invoice.amount} · {invoice.status_label}{invoice.client_visible ? ' · shared' : ''}</li>)}
                        </ul>
                        <ul className="mt-4 space-y-2 text-sm">
                            {props.change_requests.map((item) => (
                                <li key={item.id}>
                                    <p className="font-semibold">{item.title} · {item.status_label}</p>
                                    <p className="text-muted">{item.description}</p>
                                    {can.update && item.status === 'OPEN' ? (
                                        <button type="button" className="text-xs font-semibold text-teal" onClick={() => router.post(`/change-requests/${item.id}/decide`, { status: 'ACCEPTED', decision_note: 'Accepted into the plan.' }, { preserveScroll: true })}>Accept</button>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                        {can.manage_members ? (
                            <form className="mt-4 space-y-2" onSubmit={(event) => { event.preventDefault(); memberForm.put(`/projects/${project.id}/members`, { preserveScroll: true }); }}>
                                <p className="text-sm font-semibold">Project members</p>
                                {props.members.map((member) => <p key={member.id} className="text-sm">{member.name}</p>)}
                                <p className="text-xs text-muted">Membership changes are saved with the current roster. Add people from the client company before inviting them onto the project.</p>
                            </form>
                        ) : null}
                    </section>
                </div>
            ) : null}
        </>
    );
}

Show.layout = (page: React.ReactNode) => <InternalLayout>{page}</InternalLayout>;

export default Show;
