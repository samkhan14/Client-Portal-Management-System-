<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class ActivityLogger
{
    public function log(int $organizationId, ?Project $project, ?User $actor, string $event, string $summary, bool $clientVisible, ?Model $subject = null): Activity
    {
        return Activity::query()->create([
            'organization_id' => $organizationId,
            'project_id' => $project?->id,
            'actor_id' => $actor?->id,
            'event' => $event,
            'summary' => mb_substr($summary, 0, 500),
            'client_visible' => $clientVisible,
            'subject_type' => $subject ? $subject::class : null,
            'subject_id' => $subject?->getKey(),
        ]);
    }
}
