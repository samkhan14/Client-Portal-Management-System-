<?php

namespace App\Policies;

use App\Enums\MembershipRole;
use App\Models\Project;
use App\Models\StoredFile;
use App\Models\User;
use App\Support\Access;

class StoredFilePolicy
{
    public function download(User $user, StoredFile $file): bool
    {
        if (! $file->project || ! Access::canViewProject($user, $file->project)) {
            return false;
        }

        return ! (Access::role($user)?->isClient() && ! $file->client_visible);
    }

    public function upload(User $user, Project $project): bool
    {
        $role = Access::role($user);
        if (! $role || $role === MembershipRole::ReadOnly) {
            return false;
        }

        return $role->isStaff() ? Access::isProjectStaff($user, $project) : Access::canViewProject($user, $project);
    }

    public function delete(User $user, StoredFile $file): bool
    {
        if (! $this->download($user, $file)) {
            return false;
        }
        $role = Access::role($user);

        return $role === MembershipRole::AgencyOwner || $role === MembershipRole::ProjectManager || ((int) $file->uploaded_by === $user->id && $role !== MembershipRole::ReadOnly);
    }
}
