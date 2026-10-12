<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'slug', 'hourly_rate_cents', 'timezone'])]
class Organization extends Model
{
    public function memberships(): HasMany
    {
        return $this->hasMany(Membership::class);
    }

    public function clientCompanies(): HasMany
    {
        return $this->hasMany(ClientCompany::class);
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }
}
