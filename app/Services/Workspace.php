<?php

namespace App\Services;

use App\Enums\MembershipRole;
use App\Models\Activity;
use App\Models\ChangeRequest;
use App\Models\Comment;
use App\Models\Deliverable;
use App\Models\DeliverableVersion;
use App\Models\Invoice;
use App\Models\Membership;
use App\Models\Project;
use App\Models\StoredFile;
use App\Models\Task;
use App\Models\TimeEntry;
use App\Support\Access;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class Workspace
{
    public function __construct(private ProjectProgress $progress) {}

    /** @return array<string, mixed> */
    public function internalProject(Request $request, Project $project): array
    {
        $project->load(['clientCompany:id,name', 'manager:id,name', 'members.user:id,name,email', 'organization']);
        $financial = $request->user()->can('viewFinancials', $project);
        $minutes = (int) TimeEntry::query()->where('project_id', $project->id)->sum('minutes');
        $cost = (int) round($minutes / 60 * (int) $project->organization->hourly_rate_cents);

        return [
            'project' => array_merge($this->projectCore($project, false), $financial ? [
                'budget' => Money::format($project->budget_cents),
                'agreed_fee' => Money::format($project->agreed_fee_cents),
                'budget_cents' => $project->budget_cents,
                'agreed_fee_cents' => $project->agreed_fee_cents,
                'time_minutes' => $minutes,
                'cost' => Money::format($cost),
                'margin' => Money::format(($project->agreed_fee_cents ?? 0) - $cost),
            ] : []),
            'milestones' => $this->progress->milestones($project->id),
            'progress' => $this->progress->percent($project->id),
            'tasks' => $this->tasks($request, $project, false),
            'board' => $request->query('view') === 'board' ? $this->board($request, $project, false) : null,
            'comments' => $this->comments($project, false),
            'files' => $this->files($project, false),
            'deliverables' => $this->deliverables($project, false),
            'activities' => $this->activities($project, false),
            'time_entries' => TimeEntry::query()->with(['user:id,name', 'task:id,title'])->where('project_id', $project->id)->latest('work_date')->limit(30)->get()->map(fn (TimeEntry $entry) => [
                'id' => $entry->id, 'minutes' => $entry->minutes, 'work_date' => $entry->work_date?->toDateString(), 'note' => $entry->note, 'user' => $entry->user?->name, 'task' => $entry->task?->title,
            ]),
            'change_requests' => $this->changeRequests($project),
            'invoices' => $financial ? $this->invoices($project, false) : [],
            'members' => $project->members->map(fn ($member) => ['id' => $member->user_id, 'name' => $member->user->name, 'email' => $member->user->email])->values(),
            'candidates' => $this->memberCandidates($project),
            'task_options' => $this->taskOptions($project->id),
            'can' => [
                'update' => $request->user()->can('update', $project),
                'transition' => $request->user()->can('transition', $project),
                'manage_members' => $request->user()->can('manageMembers', $project),
                'financials' => $financial,
                'create_task' => $request->user()->can('create', [Task::class, $project]),
                'draft_deliverable' => $request->user()->can('draft', [DeliverableVersion::class, $project]),
            ],
        ];
    }

    /** @return array<string, mixed> */
    public function portalProject(Request $request, Project $project): array
    {
        abort_unless($request->user()->can('view', $project), 403);
        $project->load(['clientCompany:id,name', 'manager:id,name']);

        return [
            'project' => array_merge($this->projectCore($project, true), [
                'agreed_fee' => $project->fee_visible_to_client ? Money::format($project->agreed_fee_cents) : null,
            ]),
            'milestones' => $this->progress->milestones($project->id),
            'progress' => $this->progress->percent($project->id),
            'tasks' => $this->tasks($request, $project, true),
            'comments' => $this->comments($project, true),
            'files' => $this->files($project, true),
            'deliverables' => $this->deliverables($project, true),
            'activities' => $this->activities($project, true),
            'change_requests' => $this->changeRequests($project),
            'invoices' => $this->invoices($project, true),
            'can' => [
                'comment' => $request->user()->can('create', [Comment::class, $project]),
                'upload' => $request->user()->can('upload', [StoredFile::class, $project]),
                'change_request' => $request->user()->can('create', [ChangeRequest::class, $project]),
                'decide' => Access::role($request->user()) === MembershipRole::ClientAdmin,
            ],
        ];
    }

    /** @return array<string, mixed> */
    public function tasks(Request $request, ?Project $project, bool $client): array
    {
        $paginator = $this->taskQuery($request, $project, $client)
            ->orderBy('due_date')
            ->paginate(12)
            ->withQueryString()
            ->through(fn (Task $task) => $this->taskPayload($task, $client));

        return [
            'data' => $paginator->items(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'total' => $paginator->total(),
        ];
    }

    /** @return array<string, list<array<string, mixed>>> */
    public function board(Request $request, Project $project, bool $client): array
    {
        $grouped = array_fill_keys(['TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE'], []);
        foreach ($this->taskQuery($request, $project, $client)->orderBy('due_date')->limit(200)->get() as $task) {
            $grouped[$task->status->value][] = $this->taskPayload($task, $client);
        }

        return $grouped;
    }

    private function taskQuery(Request $request, ?Project $project, bool $client): Builder
    {
        $query = Task::query()->with(['assignee:id,name', 'milestone:id,name', 'creator:id,name']);
        if ($project) {
            $query->where('project_id', $project->id);
        } else {
            $query->whereHas('project', fn (Builder $projects) => $projects->visibleTo($request->user()))->with('project:id,name,reference');
        }
        if ($client) {
            $query->where('client_visible', true);
        }
        $search = trim((string) $request->query('q', ''));
        if ($search !== '') {
            $like = '%'.addcslashes($search, '%_\\').'%';
            $query->where(fn (Builder $inner) => $inner->where('title', 'like', $like)->orWhere('description', 'like', $like));
        }
        foreach (['status', 'assignee' => 'assignee_id', 'priority'] as $key => $column) {
            if (is_int($key)) {
                $key = $column;
            }
            if ($request->query($key)) {
                $query->where($column, $request->query($key));
            }
        }

        return $query;
    }

    /** @return array<string, mixed> */
    private function taskPayload(Task $task, bool $client): array
    {
        return [
            'id' => $task->id,
            'project_id' => $task->project_id,
            'project_name' => $task->relationLoaded('project') ? $task->project?->name : null,
            'title' => $task->title,
            'description' => $task->description,
            'status' => $task->status->value,
            'status_label' => $client ? $task->status->clientLabel() : $task->status->label(),
            'priority' => $task->priority->value,
            'priority_label' => $task->priority->label(),
            'assignee' => $task->assignee ? ['id' => $task->assignee->id, 'name' => $task->assignee->name] : null,
            'milestone' => $task->milestone ? ['id' => $task->milestone->id, 'name' => $task->milestone->name] : null,
            'parent_id' => $task->parent_id,
            'prerequisite_task_id' => $task->prerequisite_task_id,
            'start_date' => $task->start_date?->toDateString(),
            'due_date' => $task->due_date?->toDateString(),
            'estimate_hours' => $client ? null : $task->estimate_hours,
            'client_visible' => $task->client_visible,
        ];
    }

    /** @return list<array{id: int, name: string, email: string, role_label: string}> */
    private function memberCandidates(Project $project): array
    {
        return Membership::query()
            ->with('user:id,name,email')
            ->where('organization_id', $project->organization_id)
            ->where(function ($query) use ($project) {
                $query->whereIn('role', [
                    MembershipRole::AgencyOwner->value,
                    MembershipRole::ProjectManager->value,
                    MembershipRole::TeamMember->value,
                ])->orWhere('client_company_id', $project->client_company_id);
            })
            ->get()
            ->sortBy(fn (Membership $membership) => $membership->user?->name ?? '')
            ->map(fn (Membership $membership) => [
                'id' => $membership->user_id,
                'name' => $membership->user->name,
                'email' => $membership->user->email,
                'role_label' => $membership->role->label(),
            ])
            ->values()
            ->all();
    }

    /** @return list<array{id: int, title: string, parent_id: int|null}> */
    private function taskOptions(int $projectId): array
    {
        return Task::query()
            ->where('project_id', $projectId)
            ->orderBy('title')
            ->orderBy('id')
            ->get(['id', 'title', 'parent_id'])
            ->map(fn (Task $task) => [
                'id' => $task->id,
                'title' => $task->title,
                'parent_id' => $task->parent_id,
            ])
            ->all();
    }

    /** @return array<string, mixed> */
    private function projectCore(Project $project, bool $client): array
    {
        return [
            'id' => $project->id,
            'name' => $project->name,
            'reference' => $project->reference,
            'description' => $project->description,
            'scope' => $project->scope,
            'status' => $project->status->value,
            'status_label' => $client ? $project->status->clientLabel() : $project->status->label(),
            'priority' => $project->priority->value,
            'priority_label' => $project->priority->label(),
            'start_date' => $project->start_date?->toDateString(),
            'due_date' => $project->due_date?->toDateString(),
            'outstanding_request' => $project->outstanding_request,
            'fee_visible_to_client' => $project->fee_visible_to_client,
            'client' => $project->clientCompany ? ['id' => $project->clientCompany->id, 'name' => $project->clientCompany->name] : null,
            'manager' => $project->manager ? ['id' => $project->manager->id, 'name' => $project->manager->name] : null,
        ];
    }

    /** @return list<array<string, mixed>> */
    private function comments(Project $project, bool $client): array
    {
        return Comment::query()->with(['author:id,name', 'attachment:id,original_name'])->where('project_id', $project->id)
            ->when($client, fn (Builder $query) => $query->where('client_visible', true))->latest()->limit(40)->get()
            ->map(fn (Comment $comment) => [
                'id' => $comment->id, 'body' => $comment->body, 'client_visible' => $comment->client_visible, 'task_id' => $comment->task_id,
                'created_at' => $comment->created_at?->toIso8601String(), 'author' => $comment->author?->name,
                'file' => $comment->attachment ? ['id' => $comment->attachment->id, 'name' => $comment->attachment->original_name] : null,
            ])->all();
    }

    /** @return list<array<string, mixed>> */
    private function files(Project $project, bool $client): array
    {
        return StoredFile::query()->with('uploader:id,name')->where('project_id', $project->id)
            ->when($client, fn (Builder $query) => $query->where('client_visible', true))->latest()->get()
            ->map(fn (StoredFile $file) => [
                'id' => $file->id, 'name' => $file->original_name, 'mime' => $file->mime, 'size' => $file->size,
                'client_visible' => $file->client_visible, 'uploaded_by' => $file->uploader?->name, 'created_at' => $file->created_at?->toIso8601String(),
            ])->all();
    }

    /** @return list<array<string, mixed>> */
    private function deliverables(Project $project, bool $client): array
    {
        return Deliverable::query()->with(['versions' => fn ($query) => $query->when($client, fn ($versions) => $versions->where('status', '<>', 'DRAFT'))->with('decider:id,name')])
            ->where('project_id', $project->id)->latest()->get()
            ->map(fn (Deliverable $deliverable) => [
                'id' => $deliverable->id,
                'title' => $deliverable->title,
                'description' => $deliverable->description,
                'versions' => $deliverable->versions->map(fn ($version) => [
                    'id' => $version->id,
                    'version_number' => $version->version_number,
                    'status' => $version->status->value,
                    'status_label' => $client ? $version->status->clientLabel() : $version->status->label(),
                    'summary' => $version->summary,
                    'decision_note' => $version->decision_note,
                    'decided_by' => $version->decider?->name,
                    'decided_at' => $version->decided_at?->toIso8601String(),
                    'submitted_at' => $version->submitted_at?->toIso8601String(),
                ])->values(),
            ])->filter(fn ($row) => ! $client || $row['versions']->isNotEmpty())->values()->all();
    }

    /** @return list<array<string, mixed>> */
    private function activities(Project $project, bool $client): array
    {
        return Activity::query()->with('actor:id,name')->where('project_id', $project->id)
            ->when($client, fn (Builder $query) => $query->where('client_visible', true))->latest()->limit(40)->get()
            ->map(fn (Activity $activity) => [
                'id' => $activity->id, 'event' => $activity->event, 'summary' => $activity->summary,
                'client_visible' => $activity->client_visible, 'actor' => $activity->actor?->name, 'created_at' => $activity->created_at?->toIso8601String(),
            ])->all();
    }

    /** @return list<array<string, mixed>> */
    private function changeRequests(Project $project): array
    {
        return ChangeRequest::query()->with(['requester:id,name', 'decider:id,name'])->where('project_id', $project->id)->latest()->get()
            ->map(fn (ChangeRequest $item) => [
                'id' => $item->id, 'title' => $item->title, 'description' => $item->description, 'status' => $item->status->value,
                'status_label' => $item->status->label(), 'decision_note' => $item->decision_note, 'requester' => $item->requester?->name, 'decider' => $item->decider?->name,
            ])->all();
    }

    /** @return list<array<string, mixed>> */
    private function invoices(Project $project, bool $client): array
    {
        return Invoice::query()->where('project_id', $project->id)->when($client, fn (Builder $query) => $query->where('client_visible', true))->latest()->get()
            ->map(fn (Invoice $invoice) => [
                'id' => $invoice->id, 'number' => $invoice->number, 'amount' => Money::format($invoice->amount_cents),
                'status' => $invoice->status->value, 'status_label' => $invoice->status->label(), 'client_visible' => $invoice->client_visible,
                'issued_on' => $invoice->issued_on?->toDateString(), 'due_on' => $invoice->due_on?->toDateString(),
                'notes' => $invoice->notes, 'internal_notes' => $client ? null : $invoice->internal_notes,
            ])->all();
    }
}
