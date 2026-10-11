<?php

namespace App\Services;

use App\Enums\MembershipRole;
use App\Models\Membership;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MembershipService
{
    public function __construct(private ActivityLogger $activities) {}

    /** @param list<int> $userIds */
    public function syncProjectMembers(int $projectId, int $organizationId, array $userIds, int $clientCompanyId, User $actor): void
    {
        DB::transaction(function () use ($projectId, $organizationId, $userIds, $clientCompanyId, $actor): void {
            $ids = collect($userIds)->map(fn ($id) => (int) $id)->unique()->values();
            $memberships = Membership::query()->where('organization_id', $organizationId)->whereIn('user_id', $ids)->get()->keyBy('user_id');
            if ($memberships->count() !== $ids->count()) {
                throw ValidationException::withMessages(['member_ids' => 'Every project member must belong to this agency.']);
            }
            foreach ($memberships as $membership) {
                if ($membership->role->isClient() && (int) $membership->client_company_id !== $clientCompanyId) {
                    throw ValidationException::withMessages(['member_ids' => 'Client members must belong to the project’s client company.']);
                }
            }
            $existing = ProjectMember::query()->where('project_id', $projectId)->pluck('user_id');
            ProjectMember::query()->where('project_id', $projectId)->whereIn('user_id', $existing->diff($ids))->delete();
            foreach ($ids->diff($existing) as $userId) {
                ProjectMember::query()->create(['project_id' => $projectId, 'user_id' => $userId]);
            }
            $project = Project::query()->find($projectId);
            $this->activities->log($organizationId, $project, $actor, 'project.members_changed', 'Project access was updated.', false, $project);
        });
    }

    public function changeRole(Membership $membership, MembershipRole $role, ?int $clientCompanyId, User $actor): void
    {
        DB::transaction(function () use ($membership, $role, $clientCompanyId, $actor): void {
            $locked = Membership::query()->whereKey($membership->id)->lockForUpdate()->firstOrFail();
            $locked->role = $role;
            $locked->client_company_id = $role->isClient() ? $clientCompanyId : null;
            $locked->save();
            $this->activities->log($locked->organization_id, null, $actor, 'membership.role_changed', 'A membership role was updated.', false);
        });
    }

    public function remove(Membership $membership, User $actor): void
    {
        DB::transaction(function () use ($membership, $actor): void {
            $locked = Membership::query()->whereKey($membership->id)->lockForUpdate()->firstOrFail();
            ProjectMember::query()->where('user_id', $locked->user_id)->whereHas('project', fn ($query) => $query->where('organization_id', $locked->organization_id))->delete();
            $organizationId = $locked->organization_id;
            $locked->delete();
            $this->activities->log($organizationId, null, $actor, 'membership.removed', 'A person was removed from the agency.', false);
        });
    }
}
