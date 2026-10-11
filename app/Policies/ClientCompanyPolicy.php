<?php

namespace App\Policies;

use App\Models\ClientCompany;
use App\Models\User;
use App\Support\Access;

class ClientCompanyPolicy
{
    public function viewAny(User $user): bool
    {
        return (bool) Access::role($user)?->canManageProjects();
    }

    public function view(User $user, ClientCompany $company): bool
    {
        return $this->viewAny($user) && Access::sameOrganization($user, $company->organization_id);
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function update(User $user, ClientCompany $company): bool
    {
        return $this->view($user, $company);
    }
}
