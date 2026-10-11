<?php

namespace App\Providers;

use App\Models\AppNotification;
use App\Models\ChangeRequest;
use App\Models\ClientCompany;
use App\Models\Contact;
use App\Models\DeliverableVersion;
use App\Models\Invitation;
use App\Models\Invoice;
use App\Models\Membership;
use App\Models\OnboardingItem;
use App\Models\Project;
use App\Models\StoredFile;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $this->bindToOrganization('project', Project::class);
        $this->bindToOrganization('clientCompany', ClientCompany::class);
        $this->bindToOrganization('invoice', Invoice::class);
        $this->bindToOrganization('membership', Membership::class);
        $this->bindToOrganization('invitation', Invitation::class);
        $this->bindToOrganization('storedFile', StoredFile::class);

        Route::bind('contact', function (string $value) {
            return $this->firstOrMissing(Contact::query()->whereKey($value)->whereHas(
                'clientCompany',
                fn ($query) => $query->whereIn('organization_id', $this->organizationIds()),
            ));
        });

        Route::bind('onboardingItem', function (string $value) {
            return $this->firstOrMissing(OnboardingItem::query()->whereKey($value)->whereHas(
                'clientCompany',
                fn ($query) => $query->whereIn('organization_id', $this->organizationIds()),
            ));
        });

        Route::bind('changeRequest', function (string $value) {
            return $this->firstOrMissing(ChangeRequest::query()->whereKey($value)->whereHas(
                'project',
                fn ($query) => $query->whereIn('organization_id', $this->organizationIds()),
            ));
        });

        Route::bind('version', function (string $value) {
            return $this->firstOrMissing(DeliverableVersion::query()->whereKey($value)->whereHas(
                'deliverable.project',
                fn ($query) => $query->whereIn('organization_id', $this->organizationIds()),
            ));
        });

        Route::bind('notification', function (string $value) {
            return $this->firstOrMissing(AppNotification::query()->whereKey($value)->where('user_id', auth()->id() ?? 0));
        });
    }

    private function bindToOrganization(string $parameter, string $model): void
    {
        Route::bind($parameter, function (string $value) use ($model) {
            return $this->firstOrMissing($model::query()->whereKey($value)->whereIn('organization_id', $this->organizationIds()));
        });
    }

    /** @return list<int> */
    private function organizationIds(): array
    {
        $user = auth()->user();
        if (! $user) {
            return [];
        }

        return $user->organizationIds()->map(fn ($id) => (int) $id)->all();
    }

    private function firstOrMissing($query): mixed
    {
        $record = $query->first();
        abort_if($record === null, 404);

        return $record;
    }
}
