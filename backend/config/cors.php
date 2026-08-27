<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | ローカル開発では allowed_origins を '*'(全許可)のままにしておき、
    | 本番(Cloud Run)デプロイ時は環境変数 FRONTEND_URL に
    | フロントエンドの実際のURL(例: https://xxxx.web.app)を設定することで、
    | そのオリジンだけを許可するようになる。
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_filter([env('FRONTEND_URL')]) ?: ['*'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
