# バックエンドコードレビュー(セキュリティ・設計チェックリスト)

Laravel API(`backend/`)を8つの観点でチェックした結果。各項目について、チェック方法と結果、対応状況をまとめる。

対象範囲: `app/Http/Controllers/JobController.php`、`app/Http/Requests/*`、`app/Models/Job.php`、`routes/api.php`、`config/`、`tests/`、`.env`/`.gitignore`。

凡例: ✅ 問題なし / ⚠️ 検討の余地あり(実害は限定的) / ❌ 未対応(要対応)

---

## 1. 入力・バリデーション

| 項目 | 結果 | チェック方法 |
| --- | --- | --- |
| リクエストの検証をFormRequestに分離している | ✅ | [JobController.php](../backend/app/Http/Controllers/JobController.php)を確認。`store()`/`update()`の引数型が`StoreJobRequest`/`UpdateJobRequest`で、Controller内に`validate()`呼び出しやバリデーションロジックが一切ない |
| 保存処理は`$request->validated()`経由のみ | ✅ | `Job::create($request->validated())`、`$job->update($request->validated())`のみを使用。`grep -rn "request->all()" app/`で該当箇所ゼロを確認 |
| `$fillable`(許可リスト)を設定、`$guarded=[]`になっていない | ✅ | [Job.php](../backend/app/Models/Job.php)で`$fillable`に9項目を明示。`$guarded`は未定義 |

## 2. レスポンス設計

| 項目 | 結果 | チェック方法 |
| --- | --- | --- |
| 必要な項目だけ返している | ⚠️ | Eloquentモデルをそのまま`response()->json($job)`で返却。フィルタリングはしていないが、`job_postings`テーブルに機微情報が一切なく、全カラムがフロントで実際に使われているため実害なし。将来機微カラムを持つテーブルが増えたらAPI Resourceの導入を検討 |
| パスワード・トークン等の機微項目が含まれていない | ✅ | Job.php・マイグレーションを確認。該当する項目自体が存在しない |
| 日付・数値のフォーマットがフロントの期待と一致 | ✅ | `$casts`未定義。`created_at`/`updated_at`はLaravel標準のISO8601形式(実際のレスポンスで`2026-08-24T07:38:43.000000Z`形式を確認済み)。`application_date`はDBの生文字列(`YYYY-MM-DD`)がそのまま返り、フロントの`<input type="date">`と一致 |

## 3. HTTPステータスコード

| 項目 | 結果 | チェック方法 |
| --- | --- | --- |
| 登録201/取得・更新200/削除204 | ✅ | JobController.phpを確認。`store`は`response()->json($job, 201)`、`destroy`は`response()->json(null, 204)`、他はデフォルト200 |
| バリデーションエラー422 | ✅ | FormRequest使用により自動。Postman/curl/ブラウザでの動作確認で実際に422を確認済み(Day2、Day7) |
| 存在しないリソース404 | ✅ | `show`/`update`/`destroy`はルートモデルバインディング(`Job $job`)を使用しており、存在しないIDは自動的に404。動作確認で実際に確認済み(Day4〜7) |
| 401(認証エラー)/403(権限エラー) | — 該当なし | [requirements.md](requirements.md)で「認証機能は不要」と明記されたMVPのため未実装。複数人共有を検討する場合は要追加(別途相談済み) |

## 4. DB・Eloquent

| 項目 | 結果 | チェック方法 |
| --- | --- | --- |
| マイグレーションのカラム名がLaravel予約テーブル名と衝突していない | ✅ | Day1で実際に`jobs`テーブル(Laravel標準のキュー用)と衝突し、`job_postings`に変更済み。マイグレーション一覧で`0001_01_01_000002_create_jobs_table.php`(キュー用)と`2026_08_21_072018_create_jobs_table.php`(中身は`job_postings`を作成)が共存していることを確認 |
| N+1問題が起きていない | ✅ | Job.phpにリレーション定義が一切なく、`index()`も`Job::latest()->get()`のみ。Eager Loadingが必要な構造自体が存在しない |
| 外部キー制約・インデックスが必要な箇所に張られている | — 未設定(許容範囲) | マイグレーションに`id`以外のインデックスなし。要件定義でも検索・絞り込みは「次段階の拡張候補」となっており、現状のMVP規模では問題ない |

## 5. テスト

| 項目 | 結果 | チェック方法 |
| --- | --- | --- |
| Featureテストが「HTTPリクエスト→レスポンス」を検証している | ✅(今回追加) | [tests/Feature/JobApiTest.php](../backend/tests/Feature/JobApiTest.php)を新規作成。`$this->postJson()`/`getJson()`/`putJson()`/`deleteJson()`で実際にAPIを叩く形式 |
| 正常系だけでなく異常系も最低限テストしている | ✅(今回追加) | index/store/show/update/destroyそれぞれについて、正常系に加えて422(必須項目欠落・不正status・不正URL・給与上下限逆転・**部分更新時の既存DB値とのクロスフィールド検証**)・404(存在しないID)のケースを網羅。計14テスト・36assertion、`php artisan test`で全件パス確認済み |
| テスト用DBが本番/開発用と分離されている | ✅ | [phpunit.xml](../backend/phpunit.xml)で`DB_CONNECTION=sqlite`・`DB_DATABASE=:memory:`が設定済み。開発用の`database/database.sqlite`とは完全に分離 |

**当初「未対応」だった唯一の項目。今回`tests/Feature/JobApiTest.php`を新規作成して解消した。**

## 6. エラーハンドリング・ログ

| 項目 | 結果 | チェック方法 |
| --- | --- | --- |
| 想定外の例外でスタックトレース等が本番レスポンスに漏れない | ✅(手順として担保) | ローカルの`.env`は`APP_DEBUG=true`(開発用として意図通り)。[deploy-gcp.md](deploy-gcp.md)のCloud Runデプロイコマンドで`APP_DEBUG=false,APP_ENV=production`を明示的に設定する手順になっている。ただし実際の本番デプロイは未実施のため、手順書上の担保に留まる |
| エラー時に十分な情報がログに残る | ✅ | `.env`の`LOG_CHANNEL=stack`/`LOG_STACK=single`はLaravel標準のまま変更しておらず、`storage/logs/laravel.log`に例外が自動記録される |

## 7. 環境・設定

| 項目 | 結果 | チェック方法 |
| --- | --- | --- |
| `.env`がGitにコミットされていない | ✅ | `git ls-files \| grep backend/.env$`で該当なし(追跡されていない)。`.gitignore`にも`.env`を記載済み |
| 本番`.env`で`APP_DEBUG=false`、`APP_ENV=production` | ✅(手順として担保) | deploy-gcp.mdに明記。実際の本番デプロイは未実施 |
| `APP_KEY`が本番用に生成されている(開発用の使い回しでない) | ✅ | deploy-gcp.md Phase4で`php artisan key:generate --show`を改めて実行し、ローカルの`.env`とは別のキーをSecret Managerに登録する手順にしてある |
| CORS設定(`config/cors.php`)がフロントのドメインに対して適切 | ⚠️ | [config/cors.php](../backend/config/cors.php)を確認。`allowed_origins`は`FRONTEND_URL`環境変数があればそれのみ、なければ`'*'`(全許可)。ローカルは`FRONTEND_URL`未設定のため現状`'*'`のまま(開発中は許容)。本番デプロイ時にCloud Run側で`FRONTEND_URL`を設定する手順にはなっているが、実施済みではない |

## 8. セキュリティ全般

| 項目 | 結果 | チェック方法 |
| --- | --- | --- |
| SQLインジェクション対策(生SQL使用時のプレースホルダ) | ✅ | `grep -rn "DB::raw\|DB::select\|DB::statement\|whereRaw\|selectRaw" app/`で該当なし。全クエリがEloquent経由 |
| Mass Assignment脆弱性対策 | ✅ | 1と同じ(`$fillable`明示) |
| レート制限(`throttle`ミドルウェア)が公開APIに設定されている | ✅(今回追加) | [bootstrap/app.php](../backend/bootstrap/app.php)に`$middleware->throttleApi()`を追加し、[AppServiceProvider.php](../backend/app/Providers/AppServiceProvider.php)で`RateLimiter::for('api', ...)`をIPごと1分間60リクエストで定義。実際に61回連続リクエストを送り、60回目で`429 Too Many Requests`(`X-RateLimit-Limit: 60`)が返ることを確認済み |

**当初「未対応」だった項目。今回`bootstrap/app.php`と`AppServiceProvider.php`に追加して解消した。**

---

## 今回の対応まとめ

| 項目 | 変更内容 |
| --- | --- |
| [tests/Feature/JobApiTest.php](../backend/tests/Feature/JobApiTest.php) | 新規作成。index/store/show/update/destroyの正常系+異常系、計14テスト |
| [app/Providers/AppServiceProvider.php](../backend/app/Providers/AppServiceProvider.php) | `RateLimiter::for('api', ...)` を追加(IPごと1分間60リクエスト) |
| [bootstrap/app.php](../backend/bootstrap/app.php) | `$middleware->throttleApi()` を追加してAPIルートにレート制限を適用 |

### 動作確認

```bash
php artisan test
# 16 passed (既存のExampleTest 2件 + 今回追加の14件)
```

```bash
# レート制限の確認: 61回連続リクエストを送り、60回目で429になることを確認
for i in $(seq 1 62); do
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/api/jobs
done
# → 60回目が429、それ以外は200
```

## 未対応のまま残っている項目(要フォローアップ)

- **レスポンスがモデル直返し**(項目2) — 現状実害なしだが、機微データを持つテーブルが増えたらAPI Resource導入を検討
- **CORSが本番URLに未反映**(項目7) — deploy-gcp.mdの手順通りに本番デプロイすれば解消するが、まだ実施していない
- **401/403の認証エラー**(項目3) — 現在の「本人専用ツール」という要件では不要。複数人共有に進む場合は認証機能とあわせて対応
