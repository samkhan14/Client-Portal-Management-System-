<?php

namespace App\Http\Controllers\Internal;

use App\Enums\TaskStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\TransitionTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Models\Membership;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Services\TaskService;
use App\Services\Workspace;
use App\Support\Access;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TaskController extends Controller
{
    public function index(Request $request, Workspace $workspace): Response
    {
        $this->authorize('viewAny', Project::class);

        return Inertia::render('Internal/Tasks/Index', [
            'filters' => ['q' => $request->query('q', ''), 'status' => $request->query('status', ''), 'assignee' => $request->query('assignee', ''), 'priority' => $request->query('priority', '')],
            'tasks' => $workspace->tasks($request, null, false),
            'people' => User::query()->whereIn('id', Membership::query()->where('organization_id', Access::membership($request->user())->organization_id)->pluck('user_id'))->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(StoreTaskRequest $request, Project $project, TaskService $tasks): RedirectResponse
    {
        $data = $request->validated();
        $tasks->create($project, $request->user(), [
            'title' => $data['title'], 'description' => $data['description'] ?? null, 'assignee_id' => $data['assignee_id'] ?? null,
            'milestone_id' => $data['milestone_id'] ?? null, 'parent_id' => $data['parent_id'] ?? null, 'prerequisite_task_id' => $data['prerequisite_task_id'] ?? null,
            'priority' => $data['priority'], 'start_date' => $data['start_date'] ?? null, 'due_date' => $data['due_date'] ?? null,
            'estimate_hours' => $data['estimate_hours'] ?? null, 'client_visible' => $request->boolean('client_visible'),
        ]);

        return back()->with('success', 'Task added.');
    }

    public function update(UpdateTaskRequest $request, Project $project, Task $task, TaskService $tasks): RedirectResponse
    {
        abort_unless((int) $task->project_id === $project->id, 404);
        $data = $request->validated();
        $tasks->update($task, $request->user(), [
            'title' => $data['title'], 'description' => $data['description'] ?? null, 'assignee_id' => $data['assignee_id'] ?? null,
            'milestone_id' => $data['milestone_id'] ?? null, 'parent_id' => $data['parent_id'] ?? null, 'prerequisite_task_id' => $data['prerequisite_task_id'] ?? null,
            'priority' => $data['priority'], 'start_date' => $data['start_date'] ?? null, 'due_date' => $data['due_date'] ?? null,
            'estimate_hours' => $data['estimate_hours'] ?? null, 'client_visible' => $request->boolean('client_visible'),
        ]);

        return back()->with('success', 'Task updated.');
    }

    public function transition(TransitionTaskRequest $request, Project $project, Task $task, TaskService $tasks): RedirectResponse
    {
        abort_unless((int) $task->project_id === $project->id, 404);
        $tasks->transition($task, TaskStatus::from($request->string('status')->toString()), $request->user());

        return back()->with('success', 'Task status updated.');
    }
}
