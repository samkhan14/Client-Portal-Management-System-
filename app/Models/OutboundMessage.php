<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['user_id', 'email', 'dedupe_key', 'subject', 'body', 'status'])]
class OutboundMessage extends Model {}
