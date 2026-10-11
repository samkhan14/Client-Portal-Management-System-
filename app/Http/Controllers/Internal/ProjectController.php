<?php

namespace App\Http\Controllers\Internal;

use App\Enums\ProjectPriority;
use App\Enums\ProjectStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreProjectRequest;
use App\Http\Requests\SyncProjectMembersRequest;
use App\Http\Requests\TransitionProjectRequest;
use App\Http\Requests\UpdateProjectRequest;
use App\Models\ClientCompany;
use App\Models\Membership;
use App\Models\Project;
use App\Models\User;
use App\Services\MembershipService;
use App\Services\Money;
use App\Services\ProjectCreator;
use App\Services\ProjectProgress;
use App\Services\Workspace;
use App\Support\Access;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function index(Request $request, ProjectProgress $progress): Response
    {
        $this->authorize('viewAny', Project::class);
        $search = trim((string) $request->query('q', ''));
        $projects = Project::query()->visibleTo($request->user())->with(['clientCompany:id,name', 'manager:id,name'])
            ->when($search !== '', function ($query) use ($search) {
                $like = '%'.addcslashes($search, '%_\\').'%';
                $query->where(fn ($inner) => $inner->where('name', 'like', $like)->orWhere('reference', 'like', $like));
            })
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->when($request->query('priority'), fn ($query, $priority) => $query->where('priority', $priority))
            ->when($request->query('client'), fn ($query, $client) => $query->where('client_company_id', $client))
            ->latest('id')->paginate(10)->withQueryString();
        $percents = $progress->map($projects->getCollection()->pluck('id')->all());
        $organizationId = Access::membership($request->user())->organization_id;

        return Inertia::render('Internal/Projects/Index', [
            'filters' => ['q' => $request->query('q', ''), 'status' => $request->query('status', ''), 'priority' => $request->query('priority', ''), 'client' => $request->query('client', '')],
            'projects' => [
                'data' => $projects->getCollection()->map(fn (Project $project) => [
                    'id' => $project->id, 'name' => $project->name, 'reference' => $project->reference,
                    'status' => $project->status->value, 'status_label' => $project->status->label(),
                    'priority' => $project->priority->value, 'priority_label' => $project->priority->label(),
                    'due_date' => $project->due_date?->toDateString(), 'client' => $project->clientCompany?->name,
                    'manager' => $project->manager?->name, 'progress' => $percents[$project->id] ?? 0,
                ])->values(),
                'current_page' => $projects->currentPage(), 'last_page' => $projects->lastPage(), 'total' => $projects->total(),
            ],
            'clients' => ClientCompany::query()->where('organization_id', $organizationId)->orderBy('name')->get(['id', 'name']),
            'statuses' => array_map(fn (ProjectStatus $status) => ['value' => $status->value, 'label' => $status->label()], ProjectStatus::cases()),
        ]);
    }

    public function create(): Response
    {
        $this->authorize('create', Project::class);

        return Inertia::render('Internal/Projects/Form', ['project' => null, ...$this->formOptions()]);
    }

    public function store(StoreProjectRequest $request, ProjectCreator $creator): RedirectResponse
    {
        $data = $request->validated();
        $project = $creator->create($request->user(), [
            'organization_id' => Access::membership($request->user())->organization_id,
            'client_company_id' => $data['client_company_id'],
            'name' => $data['name'],
            'reference' => $data['reference'],
            'description' => $data['description'] ?? null,
            'scope' => $data['scope'] ?? null,
            'project_manager_id' => $data['project_manager_id'],
            'status' => ProjectStatus::Planning,
            'priority' => $data['priority'],
            'start_date' => $data['start_date'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'budget_cents' => Money::dollarsToCents($data['budget'] ?? null),
            'agreed_fee_cents' => Money::dollarsToCents($data['agreed_fee'] ?? null),
            'fee_visible_to_client' => $request->boolean('fee_visible_to_client'),
        ], $data['member_ids'] ?? []);

        return redirect()->route('projects.show', $project)->with('success', 'Project opened.');
    }

    public function show(Request $request, Project $project, Workspace $workspace): Response
    {
        $this->authorize('view', $project);

        return Inertia::render('Internal/Projects/Show', $workspace->internalProject($request, $project));
    }

    public function edit(Project $project): Response
    {
        $this->authorize('update', $project);

        return Inertia::render('Internal/Projects/Form', [
            'project' => [
                'id' => $project->id, 'name' => $project->name, 'reference' => $project->reference,
                'client_company_id' => $project->client_company_id, 'description' => $project->description, 'scope' => $project->scope,
                'project_manager_id' => $project->project_manager_id, 'priority' => $project->priority->value,
                'start_date' => $project->start_date?->toDateString(), 'due_date' => $project->due_date?->toDateString(),
                'budget' => $project->budget_cents !== null ? number_format($project->budget_cents / 100, 2, '.', '') : '',
                'agreed_fee' => $project->agreed_fee_cents !== null ? number_format($project->agreed_fee_cents / 100, 2, '.', '') : '',
                'fee_visible_to_client' => $project->fee_visible_to_client, 'outstanding_request' => $project->outstanding_request,
            ],
            ...$this->formOptions(),
        ]);
    }

    public function update(UpdateProjectRequest $request, Project $project): RedirectResponse
    {
        $data = $request->validated();
        $project->update([
            'name' => $data['name'], 'reference' => $data['reference'], 'description' => $data['description'] ?? null, 'scope' => $data['scope'] ?? null,
            'project_manager_id' => $data['project_manager_id'], 'priority' => $data['priority'],
            'start_date' => $data['start_date'] ?? null, 'due_date' => $data['due_date'] ?? null,
            'budget_cents' => Money::dollarsToCents($data['budget'] ?? null),
            'agreed_fee_cents' => Money::dollarsToCents($data['agreed_fee'] ?? null),
            'fee_visible_to_client' => $request->boolean('fee_visible_to_client'),
            'outstanding_request' => $data['outstanding_request'] ?? null,
        ]);

        return redirect()->route('projects.show', $project)->with('success', 'Project updated.');
    }

    public function transition(TransitionProjectRequest $request, Project $project, ProjectCreator $creator): RedirectResponse
    {
        $creator->transition($project, ProjectStatus::from($request->string('status')->toString()), $request->user(), $request->input('outstanding_request'));

        return back()->with('success', 'Project status updated.');
    }

    public function syncMembers(SyncProjectMembersRequest $request, Project $project, MembershipService $memberships): RedirectResponse
    {
        $memberships->syncProjectMembers($project->id, $project->organization_id, collect($request->input('member_ids', []))->push($project->project_manager_id)->all(), $project->client_company_id, $request->user());

        return back()->with('success', 'Project members updated.');
    }

    /** @return array<string, mixed> */
    private function formOptions(): array
    {
        $organizationId = Access::membership(request()->user())->organization_id;

        return [
            'clients' => ClientCompany::query()->where('organization_id', $organizationId)->orderBy('name')->get(['id', 'name']),
            'managers' => User::query()->whereIn('id', Membership::query()->where('organization_id', $organizationId)->whereIn('role', ['AGENCY_OWNER', 'PROJECT_MANAGER'])->pluck('user_id'))->orderBy('name')->get(['id', 'name']),
            'people' => User::query()->whereIn('id', Membership::query()->where('organization_id', $organizationId)->pluck('user_id'))->orderBy('name')->get(['id', 'name', 'email']),
            'priorities' => array_map(fn (ProjectPriority $priority) => ['value' => $priority->value, 'label' => $priority->label()], ProjectPriority::cases()),
        ];
    }
}
