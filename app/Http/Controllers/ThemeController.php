<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateThemeRequest;
use Illuminate\Http\RedirectResponse;

class ThemeController extends Controller
{
    public function update(UpdateThemeRequest $request): RedirectResponse
    {
        $theme = $request->string('theme')->toString();
        if ($request->user()) {
            $request->user()->forceFill(['theme' => $theme])->save();
        }

        return back()->withCookie(cookie('theme', $theme, 60 * 24 * 365, '/', null, false, false, false, 'Lax'));
    }
}
