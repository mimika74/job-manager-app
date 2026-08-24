<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Job extends Model
{
    public const STATUSES = [
        '未応募',
        '応募済',
        '書類選考中',
        '一次面接',
        '二次面接',
        '最終面接',
        '内定',
        '不採用',
        '辞退',
    ];

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