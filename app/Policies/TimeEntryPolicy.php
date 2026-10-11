<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\User;
use App\Support\Access;

class TimeEntryPolicy
{
    public function create(User $user, Project $project): bool
    {
        return Access::isProjectStaff($user, $project);
    }
}
