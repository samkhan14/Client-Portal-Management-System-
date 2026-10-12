<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreClientCompanyRequest;
use App\Http\Requests\StoreContactRequest;
use App\Http\Requests\StoreOnboardingItemRequest;
use App\Http\Requests\UpdateClientCompanyRequest;
use App\Models\ClientCompany;
use App\Models\Contact;
use App\Models\OnboardingItem;
use App\Support\Access;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class ClientCompanyController extends Controller
{
    public function index(): Response
    {
        $this->authorize('viewAny', ClientCompany::class);
        $organizationId = Access::membership(request()->user())->organization_id;
        $companies = ClientCompany::query()
            ->where('organization_id', $organizationId)
            ->withCount(['projects', 'contacts', 'onboardingItems'])
            ->orderBy('name')
            ->get()
            ->map(fn (ClientCompany $company) => [
                'id' => $company->id,
                'name' => $company->name,
                'slug' => $company->slug,
                'website' => $company->website,
                'projects_count' => $company->projects_count,
                'contacts_count' => $company->contacts_count,
                'onboarding_items_count' => $company->onboarding_items_count,
            ]);

        return Inertia::render('Internal/Clients/Index', [
            'companies' => $companies,
        ]);
    }

    public function store(StoreClientCompanyRequest $request): RedirectResponse
    {
        $company = ClientCompany::query()->create([
            ...$request->validated(),
            'organization_id' => Access::membership($request->user())->organization_id,
        ]);

        return redirect()->route('clients.show', $company)->with('success', 'Client company added.');
    }

    public function show(ClientCompany $clientCompany): Response
    {
        $this->authorize('view', $clientCompany);
        $clientCompany->load(['contacts', 'onboardingItems', 'projects:id,client_company_id,name,reference,status']);

        return Inertia::render('Internal/Clients/Show', [
            'company' => [
                'id' => $clientCompany->id,
                'name' => $clientCompany->name,
                'slug' => $clientCompany->slug,
                'website' => $clientCompany->website,
                'notes' => $clientCompany->notes,
                'contacts' => $clientCompany->contacts->map(fn (Contact $contact) => [
                    'id' => $contact->id,
                    'name' => $contact->name,
                    'email' => $contact->email,
                    'phone' => $contact->phone,
                    'title' => $contact->title,
                ]),
                'onboarding' => $clientCompany->onboardingItems->map(fn (OnboardingItem $item) => [
                    'id' => $item->id,
                    'title' => $item->title,
                    'detail' => $item->detail,
                    'is_complete' => $item->is_complete,
                ]),
                'projects' => $clientCompany->projects->map(fn ($project) => [
                    'id' => $project->id,
                    'name' => $project->name,
                    'reference' => $project->reference,
                    'status' => $project->status->value,
                    'status_label' => $project->status->label(),
                ]),
            ],
        ]);
    }

    public function update(UpdateClientCompanyRequest $request, ClientCompany $clientCompany): RedirectResponse
    {
        $clientCompany->update($request->validated());

        return back()->with('success', 'Client company updated.');
    }

    public function storeContact(StoreContactRequest $request, ClientCompany $clientCompany): RedirectResponse
    {
        $clientCompany->contacts()->create($request->validated());

        return back()->with('success', 'Contact added.');
    }

    public function destroyContact(Contact $contact): RedirectResponse
    {
        $this->authorize('update', $contact->clientCompany);
        $contact->delete();

        return back()->with('success', 'Contact removed.');
    }

    public function storeOnboarding(StoreOnboardingItemRequest $request, ClientCompany $clientCompany): RedirectResponse
    {
        $sort = (int) $clientCompany->onboardingItems()->max('sort') + 1;
        $clientCompany->onboardingItems()->create([
            ...$request->validated(),
            'sort' => $sort,
        ]);

        return back()->with('success', 'Onboarding item added.');
    }

    public function toggleOnboarding(OnboardingItem $onboardingItem): RedirectResponse
    {
        $this->authorize('update', $onboardingItem->clientCompany);
        $onboardingItem->update(['is_complete' => ! $onboardingItem->is_complete]);

        return back();
    }
}
