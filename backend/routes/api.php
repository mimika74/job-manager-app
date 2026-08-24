<?php

use App\Http\Controllers\JobController;
use Illuminate\Support\Facades\Route;

Route::apiResource('jobs', JobController::class);
