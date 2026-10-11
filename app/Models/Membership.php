<?php

namespace App\Models;

use App\Enums\MembershipRole;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InvalidArgumentException;

#[Fillable(['organization_id', 'user_id', 'role', 'client_company_id'])]
class Membership extends Model
{
    protected function casts(): array
    {
        return ['role' => MembershipRole::class];
    }

    protected static function booted(): void
    {
        static::saving(function (Membership $membership): void {
            if ($membership->role->isClient() && ! $membership->client_company_id) {
                throw new InvalidArgumentException('Client membership requires a client company.');
            }
            if ($membership->role->isStaff()) {
                $membership->client_company_id = null;
            }
        });
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function clientCompany(): BelongsTo
    {
        return $this->belongsTo(ClientCompany::class);
    }
}
