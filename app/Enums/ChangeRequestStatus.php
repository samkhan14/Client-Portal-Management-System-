<?php

namespace App\Enums;

enum ChangeRequestStatus: string
{
    case Open = 'OPEN';
    case Accepted = 'ACCEPTED';
    case Declined = 'DECLINED';

    public function label(): string
    {
        return ucfirst(strtolower($this->name));
    }
}
