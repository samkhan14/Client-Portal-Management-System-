<?php

namespace App\Policies;

use App\Enums\MembershipRole;
use App\Models\Project;
use App\Models\User;
use App\Support\Access;

class ProjectPolicy
{
    public function viewAny(User $user): bool
    {
        return Access::role($user) !== null;
    }

    public function view(User $user, Project $project): bool
    {
        return Access::canViewProject($user, $project);
    }

    public function create(User $user): bool
    {
        return (bool) Access::role($user)?->canManageProjects();
    }

    public function update(User $user, Project $project): bool
    {
        return Access::canManageProject($user, $project);
    }

    public function transition(User $user, Project $project): bool
    {
        return $this->update($user, $project);
    }

    public function manageMembers(User $user, Project $project): bool
    {
        return $this->update($user, $project);
    }

    public function viewFinancials(User $user, Project $project): bool
    {
        $role = Access::role($user);

        return ($role === MembershipRole::AgencyOwner || $role === MembershipRole::ProjectManager)
            && Access::sameOrganization($user, $project->organization_id);
    }
}
