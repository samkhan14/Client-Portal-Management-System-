<?php

namespace App\Models;

use App\Enums\DeliverableStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['deliverable_id', 'version_number', 'status', 'summary', 'created_by', 'submitted_by', 'submitted_at', 'decided_by', 'decided_at', 'decision_note'])]
class DeliverableVersion extends Model
{
    protected function casts(): array
    {
        return [
            'status' => DeliverableStatus::class,
            'version_number' => 'integer',
            'submitted_at' => 'datetime',
            'decided_at' => 'datetime',
        ];
    }

    public function deliverable(): BelongsTo
    {
        return $this->belongsTo(Deliverable::class);
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
