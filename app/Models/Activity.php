<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['organization_id', 'project_id', 'actor_id', 'event', 'summary', 'client_visible', 'subject_type', 'subject_id'])]
class Activity extends Model
{
    protected function casts(): array
    {
        return ['client_visible' => 'boolean'];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
