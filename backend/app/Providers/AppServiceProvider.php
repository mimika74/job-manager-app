<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // 個人〜小規模利用のAPIを想定し、IPごとに1分間60リクエストまでに制限する。
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->ip());
        });
    }
}
