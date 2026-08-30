# アクセスキー保護ガイド

Googleアカウントを持たない(または不明な)第三者に、このアプリを一時的に見せるための共有アクセスキー方式の実装。IAP(Identity-Aware Proxy)のようなGoogleログイン前提の仕組みを使わずに、シンプルな「合言葉」でアクセスを制限する。

## 仕組みの概要

```
[React SPA]                          [Laravel API]
  │                                       │
  │  1. 初回アクセス時、キー入力画面を表示     │
  │  2. 入力したキーで /api/access-check を叩く │
  │─────────────────────────────────────▶│
  │                                       │  EnsureAccessKeyミドルウェアが
  │                                       │  ACCESS_KEY(.env)と照合
  │◀─────────────────────────────────────│
  │  3. 成功したらlocalStorageにキーを保存    │
  │     以後の全APIリクエストにヘッダーで付与  │
  │─────────────────────────────────────▶│
```

- **バックエンド**: `app/Http/Middleware/EnsureAccessKey.php` が `api/*` の全ルートを保護。`ACCESS_KEY` 環境変数が空の場合は保護しない(=ローカル開発は今まで通りキー不要)
- **フロントエンド**: `AccessGate` コンポーネントがアプリ全体をラップし、キーが確認できるまで中身を表示しない

## バックエンド実装

| ファイル | 役割 |
| --- | --- |
| [config/access.php](../backend/config/access.php) | `ACCESS_KEY`・`ACCESS_KEY_EXPIRES_AT` 環境変数の読み込み |
| [app/Http/Middleware/EnsureAccessKey.php](../backend/app/Http/Middleware/EnsureAccessKey.php) | キー照合ミドルウェア本体 |
| [bootstrap/app.php](../backend/bootstrap/app.php) | ミドルウェアを `access.key` という名前で登録 |
| [routes/api.php](../backend/routes/api.php) | `Route::middleware('access.key')->group(...)` で `/api/jobs*` と `/api/access-check` に適用 |

### キーの渡し方(2通り対応)

1. **HTTP Basic認証** — `curl -u 任意のユーザー名:アクセスキー ...` や Postman の Basic Auth設定で使える。ユーザー名は何でもよく、パスワード欄がアクセスキーになる
2. **`X-Access-Key` ヘッダー** — SPAの`fetch`から使う方式。クロスオリジン(フロントとAPIが別ドメイン)だとブラウザ標準のBasic認証ダイアログが安定して出ないため、こちらを採用している

どちらの方式でも、一致すれば通過する。

### 有効期限

`ACCESS_KEY_EXPIRES_AT` に日時(例: `"2026-09-30 23:59:59"`、**スペースを含むのでダブルクオートで囲む**)を設定すると、その日時を過ぎた時点でキーが正しくても401になる。デモを見せ終わったらこの日時を過去にする(または`ACCESS_KEY`自体を空にする)だけで即座にアクセスを止められる。

## フロントエンド実装

| ファイル | 役割 |
| --- | --- |
| [src/lib/accessKey.ts](../frontend/src/lib/accessKey.ts) | `localStorage`へのキーの保存・取得・削除 |
| [src/components/AccessGate.tsx](../frontend/src/components/AccessGate.tsx) | キー入力画面。`App`全体をラップする |
| [src/main.tsx](../frontend/src/main.tsx) | `<AccessGate><BrowserRouter><App /></BrowserRouter></AccessGate>` の順でラップ |
| [src/api/jobs.ts](../frontend/src/api/jobs.ts) | 全APIリクエストに保存済みキーを`X-Access-Key`ヘッダーで自動付与。`verifyAccessKey()`で単体検証、401を受けたら自動的にキーを破棄してリロード |

### 動作の流れ

1. アプリ起動時、`AccessGate`が保存済みキー(未保存なら空文字)で `/api/access-check` を叩いて検証する
   - **バックエンドで`ACCESS_KEY`が未設定なら、空文字でも検証に成功する**ため、ローカル開発ではゲート画面が一切出ない
   - 本番で`ACCESS_KEY`が設定されていて、保存済みキーがない/間違っている場合はゲート画面を表示
2. ゲート画面でキーを入力して送信 → 検証成功で`localStorage`に保存 → アプリ本体を表示
3. 以後、一覧取得・登録・更新・削除などすべてのAPIリクエストに自動でキーが付与される
4. **キーが後から無効化・期限切れになった場合**、次にAPIを叩いたタイミングで401が返り、フロントは自動的に保存済みキーを削除して画面をリロードする(→ ゲート画面に戻る)

## ローカルでの動作確認方法

```bash
# 保護をかけていない状態(通常の開発)
cd backend && php artisan serve
cd frontend && npm run dev
# → ゲート画面は出ず、従来通りそのまま使える
```

保護を試したい場合は、一時的に`backend/.env`に追記する:

```
ACCESS_KEY=test-secret-123
ACCESS_KEY_EXPIRES_AT="2026-09-30 23:59:59"
```

```bash
php artisan config:clear
php artisan serve
```

この状態でフロントを開くとゲート画面が表示され、`test-secret-123`を入力すると通過できる。試し終わったら`.env`から2行を削除して`config:clear`しておくこと。

## 本番(Cloud Run)での設定

[deploy-gcp.md](deploy-gcp.md) のPhase5(Cloud Runへのデプロイ)で、環境変数に`ACCESS_KEY`・`ACCESS_KEY_EXPIRES_AT`を追加する。デプロイ後にキーだけ変更したい場合は再デプロイ不要で以下のように更新できる:

```bash
gcloud run services update job-manager-api \
  --region=asia-northeast1 \
  --update-env-vars="ACCESS_KEY=新しいキー,ACCESS_KEY_EXPIRES_AT=2026-10-15 23:59:59"
```

**注意:** カンマ区切りで環境変数を渡す都合上、`ACCESS_KEY_EXPIRES_AT`の値にスペースが含まれる点は問題ないが、キー自体にカンマを含めないこと。

## セキュリティ上の注意(重要)

これは**本格的な認証ではなく、簡易的な「合言葉」による閲覧制限**であることを理解した上で使うこと。

- キーは`gcloud run services describe`等でGCPプロジェクトにアクセスできる人からは見える(環境変数として保存されるため)。より厳重に隠したい場合はSecret Manager経由にする方法もある(deploy-gcp.mdのAPP_KEY/DB_PASSWORDと同様の扱いにできる)
- `X-Access-Key`ヘッダーは通信経路上では見えない(HTTPS前提)が、ブラウザの開発者ツールやlocalStorageを見れば誰でも中身を確認できる。**本当に見せたくない人がいる状況では使わない**
- 一時的なデモ・身内への共有用と割り切り、**見せ終わったら`ACCESS_KEY`を空にする、または`ACCESS_KEY_EXPIRES_AT`を過去日時にして必ず閉じる**こと
- 個人情報や機微なデータを扱うようになったら、この方式ではなく本格的な認証(Laravel Sanctum等)への切り替えを検討すること(以前議論した「複数人共有」構成の話と同じ文脈)
