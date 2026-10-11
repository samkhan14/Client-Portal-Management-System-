<?php

namespace App\Policies;

use App\Enums\MembershipRole;
use App\Models\Invitation;
use App\Models\User;
use App\Support\Access;

class InvitationPolicy
{
    public function create(User $user): bool
    {
        $role = Access::role($user);

        return $role === MembershipRole::AgencyOwner || $role === MembershipRole::ProjectManager;
    }

    public function revoke(User $user, Invitation $invitation): bool
    {
        $role = Access::role($user);
        if (! Access::sameOrganization($user, $invitation->organization_id)) {
            return false;
        }
        if ($role === MembershipRole::AgencyOwner) {
            return true;
        }

        return $role === MembershipRole::ProjectManager
            && in_array($invitation->role, MembershipRole::invitableBy(MembershipRole::ProjectManager), true);
    }
}
