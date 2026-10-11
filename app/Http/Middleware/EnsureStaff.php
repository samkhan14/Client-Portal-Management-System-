<?php

namespace App\Http\Middleware;

use App\Support\Access;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureStaff
{
    public function handle(Request $request, Closure $next): Response
    {
        $role = Access::role($request->user());
        if ($request->user()?->is_platform_admin && ! $role) {
            return redirect()->route('admin.organizations.index');
        }
        if ($role?->isClient()) {
            return redirect()->route('portal.home');
        }
        abort_unless($role?->isStaff(), 403);

        return $next($request);
    }
}
