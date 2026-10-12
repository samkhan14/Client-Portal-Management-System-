<?php

namespace App\Http\Controllers\Internal;

use App\Enums\MembershipRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreInvitationRequest;
use App\Http\Requests\UpdateMembershipRequest;
use App\Models\ClientCompany;
use App\Models\Invitation;
use App\Models\Membership;
use App\Models\OutboundMessage;
use App\Services\InvitationService;
use App\Services\MembershipService;
use App\Support\Access;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class TeamController extends Controller
{
    public function index(): Response
    {
        $this->authorize('create', Invitation::class);
        $membership = Access::membership(request()->user());
        $organizationId = $membership->organization_id;

        return Inertia::render('Internal/Team/Index', [
            'members' => Membership::query()
                ->with(['user:id,name,email', 'clientCompany:id,name'])
                ->where('organization_id', $organizationId)
                ->orderBy('role')
                ->get()
                ->map(fn (Membership $item) => [
                    'id' => $item->id,
                    'user_id' => $item->user_id,
                    'name' => $item->user->name,
                    'email' => $item->user->email,
                    'role' => $item->role->value,
                    'role_label' => $item->role->label(),
                    'client' => $item->clientCompany?->name,
                    'client_company_id' => $item->client_company_id,
                ]),
            'invitations' => Invitation::query()
                ->where('organization_id', $organizationId)
                ->latest()
                ->limit(30)
                ->get()
                ->map(fn (Invitation $invitation) => [
                    'id' => $invitation->id,
                    'email' => $invitation->email,
                    'role' => $invitation->role->value,
                    'role_label' => $invitation->role->label(),
                    'expires_at' => $invitation->expires_at?->toIso8601String(),
                    'accepted_at' => $invitation->accepted_at?->toIso8601String(),
                    'revoked_at' => $invitation->revoked_at?->toIso8601String(),
                    'usable' => $invitation->isUsable(),
                ]),
            'queued_messages' => $membership->role->canManageOrganization()
                ? OutboundMessage::query()
                    ->whereIn('email', $this->organizationEmails($organizationId))
                    ->latest()
                    ->limit(8)
                    ->get(['id', 'email', 'subject', 'status', 'created_at'])
                : [],
            'roles' => array_map(
                fn (MembershipRole $role) => ['value' => $role->value, 'label' => $role->label()],
                MembershipRole::invitableBy($membership->role),
            ),
            'clients' => ClientCompany::query()->where('organization_id', $organizationId)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function storeInvitation(StoreInvitationRequest $request, InvitationService $invitations): RedirectResponse
    {
        $role = MembershipRole::from($request->string('role')->toString());
        $allowed = MembershipRole::invitableBy(Access::role($request->user()));
        abort_unless(in_array($role, $allowed, true), 403);

        $invitations->issue(
            $request->user(),
            Access::membership($request->user())->organization_id,
            $request->string('email')->toString(),
            $role,
            $request->input('client_company_id'),
        );

        return back()->with('success', InvitationService::GENERIC_MESSAGE);
    }

    public function revokeInvitation(Invitation $invitation, InvitationService $invitations): RedirectResponse
    {
        $this->authorize('revoke', $invitation);
        $invitations->revoke($invitation, request()->user());

        return back()->with('success', 'Invitation revoked.');
    }

    public function updateMembership(UpdateMembershipRequest $request, Membership $membership, MembershipService $service): RedirectResponse
    {
        $service->changeRole(
            $membership,
            MembershipRole::from($request->string('role')->toString()),
            $request->input('client_company_id'),
            $request->user(),
        );

        return back()->with('success', 'Membership updated.');
    }

    public function destroyMembership(Membership $membership, MembershipService $service): RedirectResponse
    {
        $this->authorize('delete', $membership);
        $service->remove($membership, request()->user());

        return back()->with('success', 'Person removed from the agency.');
    }

    /** @return list<string> */
    private function organizationEmails(int $organizationId): array
    {
        $members = Membership::query()
            ->where('organization_id', $organizationId)
            ->with('user:id,email')
            ->get()
            ->pluck('user.email');
        $invited = Invitation::query()->where('organization_id', $organizationId)->pluck('email');

        return $members->merge($invited)->filter()->unique()->values()->all();
    }
}
