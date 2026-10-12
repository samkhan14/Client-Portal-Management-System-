import { Head } from '@inertiajs/react';
import { InternalLayout } from '@/Layouts/InternalLayout';
import { Pagination } from '@/Components/Pagination';
import { SearchField, applyFilter } from '@/Components/SearchField';
import { TaskTable } from '@/Components/TaskTable';
import type { Option, Pager, TaskRow } from '@/types';

function Index({ filters, tasks, people }: { filters: { q: string; status: string; assignee: string; priority: string }; tasks: Pager<TaskRow>; people: Option[] }) {
    return (
        <>
            <Head title="Tasks" />
            <h1 className="mb-6 font-display text-4xl">Tasks</h1>
            <div className="mb-5 grid gap-3 md:grid-cols-4">
                <SearchField initial={filters.q} />
                <select className="input" aria-label="Task status" value={filters.status} onChange={(event) => applyFilter('status', event.target.value)}>
                    <option value="">All statuses</option>
                    {['TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE'].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <select className="input" aria-label="Assignee" value={filters.assignee} onChange={(event) => applyFilter('assignee', event.target.value)}>
                    <option value="">All people</option>
                    {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
                <select className="input" aria-label="Task priority" value={filters.priority} onChange={(event) => applyFilter('priority', event.target.value)}>
                    <option value="">All priorities</option>
                    {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </select>
            </div>
            <div className="rounded-3xl border border-line bg-card p-5">
                <TaskTable tasks={tasks.data} />
            </div>
            <div className="mt-4"><Pagination page={tasks.current_page} last={tasks.last_page} total={tasks.total} /></div>
        </>
    );
}

Index.layout = (page: React.ReactNode) => <InternalLayout>{page}</InternalLayout>;
export default Index;
