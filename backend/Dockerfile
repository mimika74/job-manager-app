# syntax=docker/dockerfile:1

# ---- 依存関係のインストール ----
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-interaction --prefer-dist --no-autoloader
COPY . .
RUN composer dump-autoload --optimize --no-dev

# ---- 実行イメージ ----
FROM php:8.3-cli-alpine
WORKDIR /app

RUN apk add --no-cache \
        libzip-dev zip unzip \
        libxml2-dev \
        oniguruma-dev \
    && docker-php-ext-install pdo pdo_mysql zip mbstring xml dom bcmath fileinfo

COPY --from=vendor /app ./

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
    && chmod -R 775 storage bootstrap/cache

# Cloud Runは $PORT 環境変数でリッスンポートを指定する(デフォルト8080)
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
