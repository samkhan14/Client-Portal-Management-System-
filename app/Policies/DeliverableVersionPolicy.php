<?php

namespace App\Policies;

use App\Enums\DeliverableStatus;
use App\Enums\MembershipRole;
use App\Models\DeliverableVersion;
use App\Models\Project;
use App\Models\User;
use App\Support\Access;

class DeliverableVersionPolicy
{
    public function view(User $user, DeliverableVersion $version): bool
    {
        $project = $version->deliverable->project;
        if (! Access::canViewProject($user, $project)) {
            return false;
        }

        return ! (Access::role($user)?->isClient() && $version->status === DeliverableStatus::Draft);
    }

    public function draft(User $user, Project $project): bool
    {
        return Access::isProjectStaff($user, $project);
    }

    public function submit(User $user, DeliverableVersion $version): bool
    {
        return Access::isProjectStaff($user, $version->deliverable->project);
    }

    public function decide(User $user, DeliverableVersion $version): bool
    {
        $project = $version->deliverable->project;
        $membership = Access::membership($user);

        return $membership?->role === MembershipRole::ClientAdmin
            && (int) $membership->client_company_id === (int) $project->client_company_id
            && (int) $membership->organization_id === (int) $project->organization_id;
    }
}
