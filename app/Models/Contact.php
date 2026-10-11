<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['client_company_id', 'name', 'email', 'phone', 'title'])]
class Contact extends Model
{
    public function clientCompany(): BelongsTo
    {
        return $this->belongsTo(ClientCompany::class);
    }
}
