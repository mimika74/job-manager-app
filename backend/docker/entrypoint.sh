#!/bin/sh
set -e

# キャッシュされた設定が残っているとCloud Run上の環境変数を拾わないことがあるためクリア
php artisan config:clear

# マイグレーションを適用(このアプリの規模ではコンテナ起動時に流すシンプルな運用で十分)
# php artisan migrate --force
php artisan migrate --force || echo "MIGRATION FAILED - continuing anyway"

exec php artisan serve --host=0.0.0.0 --port="${PORT:-8080}"
