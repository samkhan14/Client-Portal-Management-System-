<?php

namespace Tests\Feature\Concerns;

use App\Enums\MembershipRole;
use App\Enums\ProjectPriority;
use App\Enums\ProjectStatus;
use App\Models\ClientCompany;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;

trait CreatesAgency
{
    protected function makeUser(string $name): User
    {
        return User::factory()->create([
            'name' => $name,
            'email' => strtolower(str_replace(' ', '.', $name)).'@example.test',
            'password' => 'password',
        ]);
    }

    protected function makeOrg(string $name = 'Northline Studio'): Organization
    {
        return Organization::query()->create([
            'name' => $name,
            'slug' => str($name)->slug().'-'.fake()->unique()->numerify('###'),
            'hourly_rate_cents' => 15000,
            'timezone' => 'America/Chicago',
        ]);
    }

    protected function makeCompany(Organization $organization, string $name): ClientCompany
    {
        return ClientCompany::query()->create([
            'organization_id' => $organization->id,
            'name' => $name,
            'slug' => str($name)->slug().'-'.fake()->unique()->numerify('###'),
        ]);
    }

    protected function join(User $user, Organization $organization, MembershipRole $role, ?ClientCompany $company = null): Membership
    {
        return Membership::query()->create([
            'organization_id' => $organization->id,
            'user_id' => $user->id,
            'role' => $role,
            'client_company_id' => $company?->id,
        ]);
    }

    /** @param list<User> $members */
    protected function makeProject(Organization $organization, ClientCompany $company, User $manager, string $reference, array $members = [], ProjectStatus $status = ProjectStatus::Planning): Project
    {
        $project = Project::query()->create([
            'organization_id' => $organization->id,
            'client_company_id' => $company->id,
            'project_manager_id' => $manager->id,
            'name' => 'Project '.$reference,
            'reference' => $reference,
            'status' => $status,
            'priority' => ProjectPriority::Normal,
        ]);
        $ids = collect($members)->push($manager)->unique('id');
        foreach ($ids as $member) {
            ProjectMember::query()->create(['project_id' => $project->id, 'user_id' => $member->id]);
        }

        return $project;
    }
}
