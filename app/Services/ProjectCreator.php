<?php

namespace App\Services;

use App\Enums\MembershipRole;
use App\Enums\ProjectStatus;
use App\Models\Membership;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProjectCreator
{
    public function __construct(
        private ActivityLogger $activities,
        private NotificationWriter $notifications,
    ) {}

    /** @param array<string, mixed> $attributes @param list<int> $memberIds */
    public function create(User $actor, array $attributes, array $memberIds): Project
    {
        return DB::transaction(function () use ($actor, $attributes, $memberIds) {
            $project = Project::query()->create($attributes);
            $ids = collect($memberIds)->push($project->project_manager_id, $actor->id)->map(fn ($id) => (int) $id)->unique()->values();
            $memberships = Membership::query()->where('organization_id', $project->organization_id)->whereIn('user_id', $ids)->get()->keyBy('user_id');

            foreach ($ids as $userId) {
                $membership = $memberships->get($userId);
                if (! $membership) {
                    throw ValidationException::withMessages(['member_ids' => 'Every project member must belong to this agency.']);
                }
                if ($membership->role->isClient() && (int) $membership->client_company_id !== (int) $project->client_company_id) {
                    throw ValidationException::withMessages(['member_ids' => 'Client members must belong to the project’s client company.']);
                }
                ProjectMember::query()->create(['project_id' => $project->id, 'user_id' => $userId]);
            }

            $this->activities->log($project->organization_id, $project, $actor, 'project.created', 'Project '.$project->reference.' was opened.', true, $project);

            return $project;
        });
    }

    public function transition(Project $project, ProjectStatus $next, User $actor, ?string $outstandingRequest): Project
    {
        return DB::transaction(function () use ($project, $next, $actor, $outstandingRequest) {
            $locked = Project::query()->whereKey($project->id)->lockForUpdate()->firstOrFail();
            if (! $locked->status->canTransitionTo($next)) {
                throw ValidationException::withMessages(['status' => 'That status change is not allowed from '.$locked->status->label().'.']);
            }
            if ($next === ProjectStatus::WaitingOnClient && trim((string) $outstandingRequest) === '') {
                throw ValidationException::withMessages(['outstanding_request' => 'Waiting on the client requires a client-visible request.']);
            }
            if ($next === ProjectStatus::WaitingOnClient) {
                $locked->outstanding_request = trim((string) $outstandingRequest);
            }
            $from = $locked->status;
            $locked->status = $next;
            $locked->save();

            $this->activities->log($locked->organization_id, $locked, $actor, 'project.status_changed', 'Project status changed from '.$from->label().' to '.$next->label().'.', true, $locked);

            if (in_array($next, [ProjectStatus::WaitingOnClient, ProjectStatus::Completed, ProjectStatus::Cancelled], true)) {
                $query = Membership::query()->with('user')->where('organization_id', $locked->organization_id);
                if ($next === ProjectStatus::WaitingOnClient) {
                    $query->where('client_company_id', $locked->client_company_id)->where('role', MembershipRole::ClientAdmin);
                } else {
                    $query->whereIn('role', [MembershipRole::AgencyOwner, MembershipRole::ProjectManager]);
                }
                foreach ($query->get() as $membership) {
                    $this->notifications->send($membership->user, $locked->organization_id, 'status', 'project-status:'.$locked->id.':'.$next->value, 'Project update', $locked->name.' is now '.$next->clientLabel().'.');
                }
            }

            return $locked->refresh();
        });
    }
}
