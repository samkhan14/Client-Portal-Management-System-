<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['client_company_id', 'title', 'detail', 'is_complete', 'sort'])]
class OnboardingItem extends Model
{
    protected function casts(): array
    {
        return ['is_complete' => 'boolean', 'sort' => 'integer'];
    }

    public function clientCompany(): BelongsTo
    {
        return $this->belongsTo(ClientCompany::class);
    }
}
