<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Support\Access;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class LoginController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Auth/Login');
    }

    public function store(LoginRequest $request): RedirectResponse
    {
        if (! Auth::attempt($request->safe()->only('email', 'password'), true)) {
            return back()->withErrors(['email' => 'Those credentials were not recognized.'])->onlyInput('email');
        }
        $request->session()->regenerate();
        $user = $request->user();
        $membership = $user->currentMembership();
        if ($membership) {
            $request->session()->put('current_organization_id', $membership->organization_id);
        }
        if ($user->theme) {
            cookie()->queue(cookie('theme', $user->theme, 60 * 24 * 365, '/', null, false, false, false, 'Lax'));
        }
        $role = Access::role($user);
        if ($user->is_platform_admin && ! $role) {
            return redirect()->intended(route('admin.organizations.index'));
        }

        return $role?->isClient()
            ? redirect()->intended(route('portal.home'))
            : redirect()->intended(route('dashboard'));
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
