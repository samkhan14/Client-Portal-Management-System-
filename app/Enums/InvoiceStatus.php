<?php

namespace App\Enums;

enum InvoiceStatus: string
{
    case Unpaid = 'UNPAID';
    case Paid = 'PAID';
    case Voided = 'VOID';

    public function label(): string
    {
        return match ($this) {
            self::Unpaid => 'Unpaid',
            self::Paid => 'Paid',
            self::Voided => 'Void',
        };
    }
}
