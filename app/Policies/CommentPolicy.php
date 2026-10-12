<?php

namespace App\Policies;

use App\Enums\MembershipRole;
use App\Models\Comment;
use App\Models\Project;
use App\Models\User;
use App\Support\Access;

class CommentPolicy
{
    public function view(User $user, Comment $comment): bool
    {
        return Access::canViewProject($user, $comment->project) && ! (Access::role($user)?->isClient() && ! $comment->client_visible);
    }

    public function create(User $user, Project $project): bool
    {
        $role = Access::role($user);
        if (! $role || $role === MembershipRole::ReadOnly) {
            return false;
        }

        return $role->isStaff() ? Access::isProjectStaff($user, $project) : Access::canViewProject($user, $project);
    }
}
