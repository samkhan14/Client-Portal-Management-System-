<?php

namespace App\Models;

use App\Enums\ChangeRequestStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['project_id', 'requested_by', 'title', 'description', 'status', 'decision_note', 'decided_by', 'decided_at'])]
class ChangeRequest extends Model
{
    protected function casts(): array
    {
        return ['status' => ChangeRequestStatus::class, 'decided_at' => 'datetime'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
