<?php

namespace App\Policies;

use App\Enums\MembershipRole;
use App\Models\Invoice;
use App\Models\User;
use App\Support\Access;

class InvoicePolicy
{
    public function viewAny(User $user): bool
    {
        $role = Access::role($user);

        return $role === MembershipRole::AgencyOwner || $role === MembershipRole::ProjectManager || (bool) $role?->isClient();
    }

    public function view(User $user, Invoice $invoice): bool
    {
        $role = Access::role($user);
        if (! $role || ! Access::sameOrganization($user, $invoice->organization_id)) {
            return false;
        }
        if ($role === MembershipRole::AgencyOwner || $role === MembershipRole::ProjectManager) {
            return true;
        }

        return $role->isClient() && $invoice->client_visible && Access::canViewProject($user, $invoice->project);
    }

    public function create(User $user): bool
    {
        return Access::role($user) === MembershipRole::AgencyOwner;
    }

    public function update(User $user, Invoice $invoice): bool
    {
        return $this->create($user) && Access::sameOrganization($user, $invoice->organization_id);
    }
}
