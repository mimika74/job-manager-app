<?php

use App\Http\Controllers\JobController;
use Illuminate\Support\Facades\Route;

Route::middleware('access.key')->group(function () {
    Route::get('/access-check', fn () => response()->json(['ok' => true]));

    Route::apiResource('jobs', JobController::class);
});
