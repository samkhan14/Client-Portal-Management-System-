<?php

namespace App\Models;

use App\Enums\MembershipRole;
use App\Enums\ProjectPriority;
use App\Enums\ProjectStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'organization_id', 'client_company_id', 'name', 'reference', 'description', 'scope',
    'project_manager_id', 'status', 'priority', 'start_date', 'due_date', 'budget_cents',
    'agreed_fee_cents', 'fee_visible_to_client', 'outstanding_request',
])]
class Project extends Model
{
    protected function casts(): array
    {
        return [
            'status' => ProjectStatus::class,
            'priority' => ProjectPriority::class,
            'start_date' => 'date',
            'due_date' => 'date',
            'budget_cents' => 'integer',
            'agreed_fee_cents' => 'integer',
            'fee_visible_to_client' => 'boolean',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function clientCompany(): BelongsTo
    {
        return $this->belongsTo(ClientCompany::class);
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'project_manager_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(ProjectMember::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_members')->withTimestamps();
    }

    public function milestones(): HasMany
    {
        return $this->hasMany(Milestone::class)->orderBy('sort')->orderBy('id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    public function deliverables(): HasMany
    {
        return $this->hasMany(Deliverable::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(StoredFile::class);
    }

    public function timeEntries(): HasMany
    {
        return $this->hasMany(TimeEntry::class);
    }

    public function changeRequests(): HasMany
    {
        return $this->hasMany(ChangeRequest::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        $membership = $user->currentMembership();
        if (! $membership) {
            return $query->whereRaw('1 = 0');
        }

        $query->where('organization_id', $membership->organization_id);

        return match ($membership->role) {
            MembershipRole::AgencyOwner, MembershipRole::ProjectManager => $query,
            MembershipRole::ClientAdmin => $query->where('client_company_id', $membership->client_company_id),
            default => $query->whereHas('members', fn (Builder $members) => $members->where('user_id', $user->id)),
        };
    }
}
