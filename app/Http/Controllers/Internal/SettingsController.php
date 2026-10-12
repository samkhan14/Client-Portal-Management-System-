<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateOrganizationRequest;
use App\Services\Money;
use App\Support\Access;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function edit(): Response
    {
        $organization = Access::membership(request()->user())->organization;
        $this->authorize('viewSettings', $organization);

        return Inertia::render('Internal/Settings/Index', [
            'organization' => [
                'id' => $organization->id,
                'name' => $organization->name,
                'slug' => $organization->slug,
                'hourly_rate' => number_format($organization->hourly_rate_cents / 100, 2, '.', ''),
                'timezone' => $organization->timezone,
            ],
        ]);
    }

    public function update(UpdateOrganizationRequest $request): RedirectResponse
    {
        $organization = Access::membership($request->user())->organization;
        $this->authorize('update', $organization);
        $organization->update([
            'name' => $request->string('name')->toString(),
            'hourly_rate_cents' => Money::dollarsToCents($request->input('hourly_rate')),
            'timezone' => $request->string('timezone')->toString(),
        ]);

        return back()->with('success', 'Agency settings saved.');
    }
}
