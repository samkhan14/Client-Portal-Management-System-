<?php

namespace App\Services;

use Illuminate\Validation\ValidationException;

class Money
{
    public static function dollarsToCents(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (! is_numeric($value)) {
            throw ValidationException::withMessages(['amount' => 'Enter a valid amount.']);
        }

        return (int) bcmul(number_format((float) $value, 2, '.', ''), '100', 0);
    }

    public static function format(?int $cents): ?string
    {
        return $cents === null ? null : '$'.number_format($cents / 100, 2);
    }
}
