<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['organization_id', 'project_id', 'uploaded_by', 'disk', 'path', 'original_name', 'mime', 'size', 'client_visible'])]
class StoredFile extends Model
{
    protected $table = 'files';

    protected function casts(): array
    {
        return ['size' => 'integer', 'client_visible' => 'boolean'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
