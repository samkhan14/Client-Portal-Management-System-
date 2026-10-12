<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['organization_id', 'project_id', 'task_id', 'deliverable_version_id', 'user_id', 'body', 'client_visible', 'file_id'])]
class Comment extends Model
{
    protected function casts(): array
    {
        return ['client_visible' => 'boolean'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function attachment(): BelongsTo
    {
        return $this->belongsTo(StoredFile::class, 'file_id');
    }
}
