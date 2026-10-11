<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'assignments', 'due_soon', 'comments', 'deliverables', 'status_changes', 'invitations'])]
class NotificationPreference extends Model
{
    protected function casts(): array
    {
        return [
            'assignments' => 'boolean',
            'due_soon' => 'boolean',
            'comments' => 'boolean',
            'deliverables' => 'boolean',
            'status_changes' => 'boolean',
            'invitations' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function allows(string $type): bool
    {
        $column = match ($type) {
            'assignment' => 'assignments',
            'due_soon' => 'due_soon',
            'comment' => 'comments',
            'deliverable' => 'deliverables',
            'status' => 'status_changes',
            'invitation' => 'invitations',
            default => null,
        };

        return $column === null ? true : (bool) $this->{$column};
    }
}
