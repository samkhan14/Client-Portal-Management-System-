<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['organization_id', 'name', 'slug', 'website', 'notes'])]
class ClientCompany extends Model
{
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(Contact::class);
    }

    public function onboardingItems(): HasMany
    {
        return $this->hasMany(OnboardingItem::class)->orderBy('sort')->orderBy('id');
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }
}
