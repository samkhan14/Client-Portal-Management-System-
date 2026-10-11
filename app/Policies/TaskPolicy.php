<?php

namespace App\Policies;

use App\Enums\MembershipRole;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Support\Access;

class TaskPolicy
{
    public function view(User $user, Task $task): bool
    {
        if (! Access::canViewProject($user, $task->project)) {
            return false;
        }

        return ! (Access::role($user)?->isClient() && ! $task->client_visible);
    }

    public function create(User $user, Project $project): bool
    {
        return Access::canManageProject($user, $project);
    }

    public function update(User $user, Task $task): bool
    {
        return Access::canManageProject($user, $task->project);
    }

    public function transition(User $user, Task $task): bool
    {
        return $this->update($user, $task) || (
            Access::role($user) === MembershipRole::TeamMember
            && (int) $task->assignee_id === $user->id
            && Access::isProjectStaff($user, $task->project)
        );
    }
}
