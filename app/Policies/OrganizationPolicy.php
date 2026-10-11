<?php

namespace App\Policies;

use App\Models\Organization;
use App\Models\User;
use App\Support\Access;

class OrganizationPolicy
{
    public function update(User $user, Organization $organization): bool
    {
        return (bool) Access::role($user)?->canManageOrganization() && Access::sameOrganization($user, $organization->id);
    }

    public function viewSettings(User $user, Organization $organization): bool
    {
        return $this->update($user, $organization);
    }
}
