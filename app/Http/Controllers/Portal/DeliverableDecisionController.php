<?php

namespace App\Http\Controllers\Portal;

use App\Enums\DeliverableStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\DecideDeliverableRequest;
use App\Models\DeliverableVersion;
use App\Services\DeliverableService;
use Illuminate\Http\RedirectResponse;

class DeliverableDecisionController extends Controller
{
    public function approve(DecideDeliverableRequest $request, DeliverableVersion $version, DeliverableService $deliverables): RedirectResponse
    {
        $deliverables->decide($version, $request->user(), DeliverableStatus::Approved, $request->string('decision_note')->toString());

        return back()->with('success', 'Version approved. It will not be overwritten.');
    }

    public function requestChanges(DecideDeliverableRequest $request, DeliverableVersion $version, DeliverableService $deliverables): RedirectResponse
    {
        $deliverables->decide($version, $request->user(), DeliverableStatus::ChangesRequested, $request->string('decision_note')->toString());

        return back()->with('success', 'Changes requested. The studio will open a new version.');
    }
}
