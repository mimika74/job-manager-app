<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Job extends Model
{
    protected $table = 'job_postings';

    protected $fillable = [
        'company_name',
        'position',
        'status',
        'application_date',
        'url',
        'location',
        'salary_min',
        'salary_max',
        'memo',
    ];
}