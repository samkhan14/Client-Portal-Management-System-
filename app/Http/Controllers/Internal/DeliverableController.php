<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDeliverableRequest;
use App\Http\Requests\UpdateDeliverableDraftRequest;
use App\Models\Deliverable;
use App\Models\DeliverableVersion;
use App\Models\Project;
use App\Services\DeliverableService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class DeliverableController extends Controller
{
    public function store(StoreDeliverableRequest $request, Project $project, DeliverableService $deliverables): RedirectResponse
    {
        $deliverables->create($project, $request->user(), $request->string('title')->toString(), $request->input('description'), $request->input('summary'));

        return back()->with('success', 'Draft deliverable started.');
    }

    public function newVersion(Request $request, Project $project, Deliverable $deliverable, DeliverableService $deliverables): RedirectResponse
    {
        $this->authorize('draft', [DeliverableVersion::class, $project]);
        abort_unless((int) $deliverable->project_id === $project->id, 404);
        $deliverables->startNextVersion($deliverable, $request->user());

        return back()->with('success', 'A new version was opened. The previous version is unchanged.');
    }

    public function updateDraft(UpdateDeliverableDraftRequest $request, DeliverableVersion $version, DeliverableService $deliverables): RedirectResponse
    {
        $deliverables->updateDraft($version, $request->user(), $request->input('summary'));

        return back()->with('success', 'Draft saved.');
    }

    public function submit(Request $request, DeliverableVersion $version, DeliverableService $deliverables): RedirectResponse
    {
        $this->authorize('submit', $version);
        $deliverables->submit($version, $request->user());

        return back()->with('success', 'Deliverable submitted for review.');
    }
}
