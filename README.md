# 求人管理アプリ

転職活動中の応募求人を一元管理するための個人用Webアプリです。
求人の登録・一覧表示・選考ステータス管理・メモ機能を提供します。

**公開URL:** https://job-manager-app-507111.web.app/

本プロジェクトは [Claude Code](https://claude.com/claude-code) を使用して開発しています。

## 技術スタック

- バックエンド: Laravel (PHP)
- フロントエンド: React (Vite)
- DB: SQLite

## ディレクトリ構成・DB設計・API仕様

詳細は [`docs/design.md`](./docs/design.md) を参照してください。

## セットアップ

### バックエンド (Laravel)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate
```

### フロントエンド (React)

```bash
cd frontend
npm install
```

## 起動方法

```bash
# バックエンド (backendディレクトリで)
php artisan serve

# フロントエンド (frontendディレクトリで、別ターミナル)
npm run dev
```

- バックエンド: http://localhost:8000
- フロントエンド: http://localhost:5173

## 開発状況

- [ ] 求人登録
- [ ] 一覧表示
- [ ] ステータス変更
- [ ] メモ機能
