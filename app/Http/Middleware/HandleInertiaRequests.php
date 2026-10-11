<?php

namespace App\Http\Middleware;

use App\Enums\MembershipRole;
use App\Models\AppNotification;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /** @return array<string, mixed> */
    public function share(Request $request): array
    {
        $user = $request->user();
        $membership = $user?->currentMembership();
        $role = $membership?->role;
        $organization = $membership?->organization;
        $preferences = $user?->notificationPreference;

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'theme' => $user->theme,
                    'is_platform_admin' => (bool) $user->is_platform_admin,
                ] : null,
                'membership' => $membership ? [
                    'id' => $membership->id,
                    'role' => $role?->value,
                    'role_label' => $role?->label(),
                    'client_company_id' => $membership->client_company_id,
                ] : null,
                'organization' => $organization ? [
                    'id' => $organization->id,
                    'name' => $organization->name,
                ] : null,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            'unread_notifications' => fn () => $user
                ? AppNotification::query()->where('user_id', $user->id)->whereNull('read_at')->count()
                : 0,
            'theme' => $request->cookie('theme') ?: $user?->theme,
            'notification_preferences' => $user ? [
                'assignments' => (bool) ($preferences->assignments ?? true),
                'due_soon' => (bool) ($preferences->due_soon ?? true),
                'comments' => (bool) ($preferences->comments ?? true),
                'deliverables' => (bool) ($preferences->deliverables ?? true),
                'status_changes' => (bool) ($preferences->status_changes ?? true),
                'invitations' => (bool) ($preferences->invitations ?? true),
            ] : null,
            'abilities' => [
                'manage_organization' => (bool) $role?->canManageOrganization(),
                'manage_projects' => (bool) $role?->canManageProjects(),
                'invite' => $role !== null && MembershipRole::invitableBy($role) !== [],
                'invoice' => $role === MembershipRole::AgencyOwner,
                'view_invoices' => $role === MembershipRole::AgencyOwner || $role === MembershipRole::ProjectManager,
            ],
        ];
    }
}
