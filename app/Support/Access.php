<?php

namespace App\Support;

use App\Enums\MembershipRole;
use App\Models\Membership;
use App\Models\Project;
use App\Models\User;

class Access
{
    public static function membership(?User $user): ?Membership
    {
        return $user?->currentMembership();
    }

    public static function role(?User $user): ?MembershipRole
    {
        return self::membership($user)?->role;
    }

    public static function sameOrganization(User $user, int $organizationId): bool
    {
        $membership = self::membership($user);

        return $membership !== null && (int) $membership->organization_id === $organizationId;
    }

    public static function canViewProject(User $user, Project $project): bool
    {
        return Project::query()->visibleTo($user)->whereKey($project->id)->exists();
    }

    public static function canManageProject(User $user, Project $project): bool
    {
        return (bool) self::role($user)?->canManageProjects()
            && self::sameOrganization($user, $project->organization_id);
    }

    public static function isProjectStaff(User $user, Project $project): bool
    {
        $role = self::role($user);
        if (! $role?->isStaff() || ! self::sameOrganization($user, $project->organization_id)) {
            return false;
        }

        return $role->canManageProjects() || $project->members()->where('user_id', $user->id)->exists();
    }
}
