<?php

namespace App\Http\Middleware;

use App\Support\Access;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureClient
{
    public function handle(Request $request, Closure $next): Response
    {
        $role = Access::role($request->user());
        if ($role?->isStaff()) {
            return redirect()->route('dashboard');
        }
        abort_unless($role?->isClient(), 403);

        return $next($request);
    }
}
