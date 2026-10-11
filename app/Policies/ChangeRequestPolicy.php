<?php

namespace App\Policies;

use App\Enums\MembershipRole;
use App\Models\ChangeRequest;
use App\Models\Project;
use App\Models\User;
use App\Support\Access;

class ChangeRequestPolicy
{
    public function create(User $user, Project $project): bool
    {
        $role = Access::role($user);
        if (! $role || $role === MembershipRole::ReadOnly || $role === MembershipRole::TeamMember) {
            return false;
        }

        return $role->canManageProjects() ? Access::sameOrganization($user, $project->organization_id) : Access::canViewProject($user, $project);
    }

    public function decide(User $user, ChangeRequest $changeRequest): bool
    {
        return Access::canManageProject($user, $changeRequest->project);
    }
}
