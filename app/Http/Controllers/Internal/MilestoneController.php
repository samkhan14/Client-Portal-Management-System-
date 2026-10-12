<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMilestoneRequest;
use App\Models\Milestone;
use App\Models\Project;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class MilestoneController extends Controller
{
    public function store(StoreMilestoneRequest $request, Project $project): RedirectResponse
    {
        $project->milestones()->create([...$request->validated(), 'sort' => (int) $project->milestones()->max('sort') + 1]);

        return back()->with('success', 'Milestone added.');
    }

    public function update(StoreMilestoneRequest $request, Project $project, Milestone $milestone): RedirectResponse
    {
        abort_unless((int) $milestone->project_id === $project->id, 404);
        $milestone->update($request->validated());

        return back()->with('success', 'Milestone updated.');
    }

    public function destroy(Request $request, Project $project, Milestone $milestone): RedirectResponse
    {
        $this->authorize('update', $project);
        abort_unless((int) $milestone->project_id === $project->id, 404);
        $milestone->delete();

        return back()->with('success', 'Milestone removed.');
    }
}
