<?php

namespace App\Enums;

enum DeliverableStatus: string
{
    case Draft = 'DRAFT';
    case Submitted = 'SUBMITTED';
    case Approved = 'APPROVED';
    case ChangesRequested = 'CHANGES_REQUESTED';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Submitted => 'Submitted',
            self::Approved => 'Approved',
            self::ChangesRequested => 'Changes requested',
        };
    }

    public function clientLabel(): string
    {
        return match ($this) {
            self::Submitted => 'Ready for your review',
            default => $this->label(),
        };
    }
}
