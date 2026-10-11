<?php

namespace App\Http\Controllers\Portal;

use App\Enums\DeliverableStatus;
use App\Enums\ProjectStatus;
use App\Http\Controllers\Controller;
use App\Models\DeliverableVersion;
use App\Models\Project;
use App\Services\ProjectProgress;
use App\Support\Access;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(ProjectProgress $progress): Response
    {
        $user = request()->user();
        $projects = Project::query()
            ->visibleTo($user)
            ->with('clientCompany:id,name')
            ->latest('id')
            ->get();
        $percents = $progress->map($projects->pluck('id')->all());

        $pending = DeliverableVersion::query()
            ->with('deliverable.project:id,name')
            ->where('status', DeliverableStatus::Submitted)
            ->whereHas('deliverable.project', fn ($query) => $query->visibleTo($user))
            ->latest('submitted_at')
            ->limit(8)
            ->get()
            ->map(fn (DeliverableVersion $version) => [
                'id' => $version->id,
                'title' => $version->deliverable->title,
                'version_number' => $version->version_number,
                'project_id' => $version->deliverable->project_id,
                'project_name' => $version->deliverable->project->name,
                'status_label' => $version->status->clientLabel(),
            ]);

        $waiting = $projects->filter(fn (Project $project) => $project->status === ProjectStatus::WaitingOnClient)->map(fn (Project $project) => [
            'id' => $project->id,
            'name' => $project->name,
            'outstanding_request' => $project->outstanding_request,
        ])->values();

        return Inertia::render('Portal/Home', [
            'company' => Access::membership($user)?->clientCompany?->name,
            'projects' => $projects->map(fn (Project $project) => [
                'id' => $project->id,
                'name' => $project->name,
                'reference' => $project->reference,
                'status' => $project->status->value,
                'status_label' => $project->status->clientLabel(),
                'due_date' => $project->due_date?->toDateString(),
                'progress' => $percents[$project->id] ?? 0,
            ])->values(),
            'pending_approvals' => $pending,
            'waiting_on_you' => $waiting,
        ]);
    }
}
