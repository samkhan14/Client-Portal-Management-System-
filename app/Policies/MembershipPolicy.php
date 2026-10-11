<?php

namespace App\Policies;

use App\Enums\MembershipRole;
use App\Models\Membership;
use App\Models\User;
use App\Support\Access;

class MembershipPolicy
{
    public function update(User $user, Membership $membership): bool
    {
        return Access::role($user) === MembershipRole::AgencyOwner
            && Access::sameOrganization($user, $membership->organization_id)
            && $user->id !== $membership->user_id;
    }

    public function delete(User $user, Membership $membership): bool
    {
        return $this->update($user, $membership);
    }
}
