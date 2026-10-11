<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\AcceptInvitationRequest;
use App\Models\User;
use App\Services\InvitationService;
use App\Support\Access;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class AcceptInvitationController extends Controller
{
    public function create(string $token, InvitationService $invitations): Response
    {
        $invitation = $invitations->findUsable($token);
        if (! $invitation) {
            return Inertia::render('Auth/AcceptInvitation', [
                'token' => $token,
                'valid' => false,
                'message' => InvitationService::INVALID_MESSAGE,
                'needs_account' => false,
            ]);
        }

        return Inertia::render('Auth/AcceptInvitation', [
            'token' => $token,
            'valid' => true,
            'message' => null,
            'needs_account' => ! User::query()->where('email', $invitation->email)->exists(),
            'email' => $invitation->email,
            'role_label' => $invitation->role->label(),
            'organization' => $invitation->organization->name,
        ]);
    }

    public function store(AcceptInvitationRequest $request, string $token, InvitationService $invitations): RedirectResponse
    {
        $user = $invitations->accept($token, $request->user(), $request->validated());
        Auth::login($user);
        $request->session()->regenerate();

        return Access::role($user)?->isClient()
            ? redirect()->route('portal.home')->with('success', 'Invitation accepted.')
            : redirect()->route('dashboard')->with('success', 'Invitation accepted.');
    }
}
