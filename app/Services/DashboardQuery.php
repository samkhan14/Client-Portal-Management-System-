<?php

namespace App\Services;

use App\Enums\DeliverableStatus;
use App\Enums\MembershipRole;
use App\Enums\ProjectStatus;
use App\Enums\TaskStatus;
use App\Models\User;
use App\Support\Access;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class DashboardQuery
{
    /** @return array<string, mixed> */
    public function forOrganization(int $organizationId): array
    {
        return $this->aggregate($organizationId, null);
    }

    /** @return array<string, mixed> */
    public function forUser(User $user): array
    {
        $membership = Access::membership($user);
        abort_unless($membership, 403);
        $restricted = $membership->role === MembershipRole::TeamMember
            ? DB::table('project_members')->where('user_id', $user->id)->pluck('project_id')->all()
            : null;

        return $this->aggregate((int) $membership->organization_id, $restricted);
    }

    /** @param list<int>|null $projectIds @return array<string, mixed> */
    private function aggregate(int $organizationId, ?array $projectIds): array
    {
        $counts = $this->projects($organizationId, $projectIds)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');
        $byStatus = [];
        foreach (ProjectStatus::cases() as $status) {
            $byStatus[$status->value] = (int) ($counts[$status->value] ?? 0);
        }

        $openTasks = fn () => $this->tasks($organizationId, $projectIds)->where('tasks.status', '<>', TaskStatus::Done->value);

        return [
            'projects_by_status' => $byStatus,
            'overdue_task_count' => (clone $openTasks())->whereNotNull('tasks.due_date')->whereDate('tasks.due_date', '<', today())->count(),
            'overdue_tasks' => (clone $openTasks())
                ->leftJoin('users', 'users.id', '=', 'tasks.assignee_id')
                ->whereNotNull('tasks.due_date')
                ->whereDate('tasks.due_date', '<', today())
                ->orderBy('tasks.due_date')
                ->limit(8)
                ->get(['tasks.id', 'tasks.title', 'tasks.due_date', 'tasks.project_id', 'projects.name as project_name', 'users.name as assignee_name']),
            'upcoming_milestones' => DB::table('milestones')
                ->join('projects', 'projects.id', '=', 'milestones.project_id')
                ->where('projects.organization_id', $organizationId)
                ->when($projectIds !== null, fn (Builder $query) => $query->whereIn('projects.id', $projectIds))
                ->whereNotIn('projects.status', [ProjectStatus::Completed->value, ProjectStatus::Cancelled->value])
                ->whereNotNull('milestones.due_date')
                ->whereDate('milestones.due_date', '>=', today())
                ->whereDate('milestones.due_date', '<=', today()->addDays(14))
                ->orderBy('milestones.due_date')
                ->limit(8)
                ->get(['milestones.id', 'milestones.name', 'milestones.due_date', 'projects.id as project_id', 'projects.name as project_name']),
            'deliverables_awaiting_approval' => DB::table('deliverable_versions')
                ->join('deliverables', 'deliverables.id', '=', 'deliverable_versions.deliverable_id')
                ->join('projects', 'projects.id', '=', 'deliverables.project_id')
                ->where('projects.organization_id', $organizationId)
                ->when($projectIds !== null, fn (Builder $query) => $query->whereIn('projects.id', $projectIds))
                ->where('deliverable_versions.status', DeliverableStatus::Submitted->value)
                ->count(),
            'workload' => $openTasks()
                ->join('users', 'users.id', '=', 'tasks.assignee_id')
                ->groupBy('users.id', 'users.name')
                ->orderByDesc('open_tasks')
                ->selectRaw('users.id as user_id, users.name as name, COUNT(*) as open_tasks')
                ->get(),
            'outstanding_client_actions' => $this->projects($organizationId, $projectIds)
                ->where('status', ProjectStatus::WaitingOnClient->value)
                ->count(),
        ];
    }

    /** @param list<int>|null $projectIds */
    private function projects(int $organizationId, ?array $projectIds): Builder
    {
        return DB::table('projects')
            ->where('organization_id', $organizationId)
            ->when($projectIds !== null, fn (Builder $query) => $query->whereIn('id', $projectIds));
    }

    /** @param list<int>|null $projectIds */
    private function tasks(int $organizationId, ?array $projectIds): Builder
    {
        return DB::table('tasks')
            ->join('projects', 'projects.id', '=', 'tasks.project_id')
            ->where('projects.organization_id', $organizationId)
            ->when($projectIds !== null, fn (Builder $query) => $query->whereIn('projects.id', $projectIds));
    }
}
