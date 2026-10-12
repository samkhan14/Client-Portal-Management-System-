<?php

namespace App\Services;

use App\Enums\TaskStatus;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskStatusHistory;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TaskService
{
    public function __construct(private ActivityLogger $activities, private NotificationWriter $notifications) {}

    /** @param array<string, mixed> $attributes */
    public function create(Project $project, User $actor, array $attributes): Task
    {
        return DB::transaction(function () use ($project, $actor, $attributes) {
            $attributes['project_id'] = $project->id;
            $attributes['creator_id'] = $actor->id;
            $attributes['status'] = $attributes['status'] ?? TaskStatus::Todo;
            if (! empty($attributes['parent_id']) && empty($attributes['milestone_id'])) {
                $parent = Task::query()->where('project_id', $project->id)->find($attributes['parent_id']);
                $attributes['milestone_id'] = $parent?->milestone_id;
            }
            $task = Task::query()->create($attributes);
            TaskStatusHistory::query()->create(['task_id' => $task->id, 'from_status' => null, 'to_status' => $task->status->value, 'user_id' => $actor->id]);
            $this->activities->log($project->organization_id, $project, $actor, 'task.created', 'Task “'.$task->title.'” was added.', (bool) $task->client_visible, $task);
            if ($task->assignee_id && (int) $task->assignee_id !== $actor->id) {
                $this->notifyAssignment($task, $project);
            }

            return $task;
        });
    }

    /** @param array<string, mixed> $attributes */
    public function update(Task $task, User $actor, array $attributes): Task
    {
        return DB::transaction(function () use ($task, $actor, $attributes) {
            $locked = Task::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();
            $previousAssignee = $locked->assignee_id;
            $previousDue = $locked->due_date?->toDateString();
            $locked->fill($attributes)->save();
            $project = $locked->project;
            if ($previousAssignee !== $locked->assignee_id && $locked->assignee_id) {
                $this->activities->log($project->organization_id, $project, $actor, 'task.assigned', 'Task “'.$locked->title.'” was assigned.', (bool) $locked->client_visible, $locked);
                $this->notifyAssignment($locked, $project);
            }
            if ($previousDue !== $locked->due_date?->toDateString()) {
                $this->activities->log($project->organization_id, $project, $actor, 'task.deadline_changed', 'The deadline for “'.$locked->title.'” was updated.', (bool) $locked->client_visible, $locked);
            }

            return $locked;
        });
    }

    public function transition(Task $task, TaskStatus $next, User $actor): Task
    {
        return DB::transaction(function () use ($task, $next, $actor) {
            $locked = Task::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();
            if (! $locked->status->canTransitionTo($next)) {
                throw ValidationException::withMessages(['status' => 'That task status change is not allowed.']);
            }
            if ($next === TaskStatus::Done && $locked->prerequisite && $locked->prerequisite->status !== TaskStatus::Done) {
                throw ValidationException::withMessages(['status' => 'Finish the prerequisite task before marking this one done.']);
            }
            $from = $locked->status;
            $locked->status = $next;
            $locked->save();
            TaskStatusHistory::query()->create(['task_id' => $locked->id, 'from_status' => $from->value, 'to_status' => $next->value, 'user_id' => $actor->id]);
            $this->activities->log($locked->project->organization_id, $locked->project, $actor, 'task.status_changed', '“'.$locked->title.'” moved from '.$from->label().' to '.$next->label().'.', (bool) $locked->client_visible, $locked);

            return $locked;
        });
    }

    private function notifyAssignment(Task $task, Project $project): void
    {
        $assignee = $task->assignee;
        if (! $assignee) {
            return;
        }
        $this->notifications->send($assignee, $project->organization_id, 'assignment', 'task-assigned:'.$task->id.':'.$assignee->id, 'Task assigned', 'You were assigned “'.$task->title.'” on '.$project->name.'.');
    }
}
