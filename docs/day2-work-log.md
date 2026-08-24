# Day2 作業ログ: JobController(CRUD) + FormRequestバリデーション

## 目的

求人データに対するCRUD APIをLaravelで実装し、Postman/curlで単体動作確認を行う。

対象要件: [requirements.md](requirements.md) の「必要機能(第一段階)」のうち、求人登録・ステータス変更・メモの永続化を担うバックエンドAPI部分。

---

## 作成・変更したファイル

| ファイル | 内容 |
| --- | --- |
| [routes/api.php](../backend/routes/api.php) | 新規作成。`Route::apiResource('jobs', JobController::class)` を定義 |
| [bootstrap/app.php](../backend/bootstrap/app.php) | `withRouting()` に `api: __DIR__.'/../routes/api.php'` を追加(Laravel 13はデフォルトでAPIルーティングが無効なため) |
| [app/Models/Job.php](../backend/app/Models/Job.php) | ステータス9段階を `Job::STATUSES` 定数として追加 |
| [app/Http/Requests/StoreJobRequest.php](../backend/app/Http/Requests/StoreJobRequest.php) | 新規登録用バリデーション |
| [app/Http/Requests/UpdateJobRequest.php](../backend/app/Http/Requests/UpdateJobRequest.php) | 更新用バリデーション(部分更新対応) |
| [app/Http/Controllers/JobController.php](../backend/app/Http/Controllers/JobController.php) | index/store/show/update/destroy |
| [postman/JobManagerAPI.postman_collection.json](../postman/JobManagerAPI.postman_collection.json) | Postmanコレクション(正常系7件+異常系7件、自動アサーション付き) |
| [postman/Local.postman_environment.json](../postman/Local.postman_environment.json) | `base_url` を定義するローカル用Environment |

※ [design.md](design.md) ではコントローラーを `App\Http\Controllers\Api\JobController` として計画していたが、実装ではネームスペースを切らず `App\Http\Controllers\JobController` とした。

---

## 手動で行う場合の手順

### 1. APIルーティングを有効化する

Laravel 11以降(本プロジェクトは13)は `routes/api.php` がデフォルトで存在せず、`bootstrap/app.php` にも登録されていない。

```bash
touch backend/routes/api.php
```

`backend/routes/api.php`:

```php
<?php

use App\Http\Controllers\JobController;
use Illuminate\Support\Facades\Route;

Route::apiResource('jobs', JobController::class);
```

`backend/bootstrap/app.php` の `withRouting()` に1行追加:

```php
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',   // ← 追加
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
```

### 2. モデルにステータス選択肢を定義

`backend/app/Models/Job.php` の `class Job extends Model {` 直後に定数を追加:

```php
public const STATUSES = [
    '未応募', '応募済', '書類選考中', '一次面接', '二次面接',
    '最終面接', '内定', '不採用', '辞退',
];
```

### 3. FormRequestを作成

```bash
cd backend
php artisan make:request StoreJobRequest
php artisan make:request UpdateJobRequest
```

生成された2ファイルの `authorize()` を `true` に、`rules()` に以下を実装する(要点):

- `company_name` / `position` — `required|string|max:255`(更新時は `sometimes|required`)
- `status` — `required|Rule::in(Job::STATUSES)`
- `application_date` — `nullable|date`
- `url` — `nullable|url|max:2048`
- `salary_min` / `salary_max` — `nullable|integer|min:0`、`salary_max >= salary_min` を検証

**注意点:** 更新(PATCH)で `salary_max` だけを送るような部分更新の場合、標準の `gte:salary_min` ルールはリクエストに含まれていない `salary_min` と比較できず正しく動かない。`UpdateJobRequest::withValidator()` 内で `$this->route('job')` から既存のDB値を取得し、リクエスト値とマージしてから比較するカスタムチェックを実装した。

### 4. コントローラーを作成

```bash
php artisan make:controller JobController
```

`index/store/show/update/destroy` を実装し、`store`/`update` の引数型を `StoreJobRequest`/`UpdateJobRequest` にすることで自動的にバリデーションが走る。ルートモデルバインディングにより `show`/`update`/`destroy` は `Job $job` を受け取るだけで存在しないIDは自動的に404になる。

### 5. ルーティングとマイグレーションの確認

```bash
cd backend
php artisan route:list --path=api
php artisan migrate:status
```

---

## 動作確認方法

### curlで確認する場合

```bash
cd backend
php artisan serve
```

別ターミナルで:

```bash
# 一覧取得
curl -s http://127.0.0.1:8000/api/jobs -H "Accept: application/json"

# 新規登録
curl -s -X POST http://127.0.0.1:8000/api/jobs \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"company_name":"Test","position":"Engineer","status":"未応募"}'

# 詳細取得 / 更新 / 削除も同様に {id} を差し替えて実行
```

**注意点:** Windows + Git Bashで日本語(マルチバイト文字)を含むJSONを `curl -d '...'` に直接渡すと、途中でエンコードが壊れて422エラーになることがある。日本語を含むボディをテストする場合は、いったんUTF-8のファイルに保存し `--data-binary @file.json` で渡すと安定する。

### Postmanで確認する場合

1. Postmanにサインイン(無料アカウントでOK)。サインインしていない「Lightweight API Client」モードだとファイルインポートが使えず、cURL貼り付けのみになる。
2. `postman/JobManagerAPI.postman_collection.json` と `postman/Local.postman_environment.json` をImport(ドラッグ&ドロップ)
3. 右上のEnvironmentを **Local** に切り替え(`base_url = http://127.0.0.1:8000` が展開される)
4. `php artisan serve` でサーバーを起動した状態で、コレクション内「1. 正常系」フォルダを上から順にSend、または右クリック→Run collectionで一括実行
5. 「2. バリデーションエラー」フォルダで異常系(必須項目欠落・不正status・不正URL・不正日付・給与上下限逆転・存在しないID)を確認

コレクションの各リクエストには `pm.test()` によるアサーション(ステータスコード、レスポンス内容)を仕込んであるため、Test Resultsタブで✅/❌が一目で分かる。

---

## 確認結果

正常系7件・異常系7件、全14シナリオを実行し、すべて想定通りのステータスコード(201/200/204/404/422)およびエラー内容であることを確認した。
