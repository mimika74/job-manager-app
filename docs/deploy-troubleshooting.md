# GCPデプロイ トラブルシューティング

実際にCloud Run + Cloud SQL + Firebase Hostingへデプロイした際に発生した問題と解決策の記録。手順自体は[deploy-gcp.md](deploy-gcp.md)を参照し、詰まった時に該当する症状をこのページで探す使い方を想定している。

対象構成: Laravel(Cloud Run, PHP 8.4)+ MySQL 8.0(Cloud SQL)+ React/Vite(Firebase Hosting)

---

## 1. Cloud SQLインスタンス構築

### 症状: `gcloud sql users set-password` で403エラー / `gcloud sql instances describe` で404エラー

**原因:** インスタンス自体が作成されていなかった(最初の`instances create`が未実行、または実行済みだと思い込んでいたが実際には失敗していた)。

**対処法:** `gcloud sql instances list` で存在確認し、なければ作成コマンドをやり直す。

### チェックリスト

- [ ] `gcloud services enable sqladmin.googleapis.com` を先に実行しておく
- [ ] `gcloud billing projects describe $(gcloud config get-value project)` で `billingEnabled: true` を確認しておく
- [ ] `instances create` 実行後は必ず `gcloud sql instances list` で存在確認する(コマンドが通っても実際には失敗していることがある)
- [ ] root用とアプリ用のパスワードは必ず別にする。生成例: `openssl rand -base64 20 | tr -dc 'A-Za-z0-9' | head -c 20`
- [ ] 生成したパスワードはSecret Managerに保存し、**DBユーザーに設定した値と必ず一致させる**(不一致になった場合の対処は「4. DB接続エラー」参照)

---

## 2. Secret Managerの権限エラー

### 症状

```
ERROR: (gcloud.run.deploy) spec.template.spec.containers[0].env[16].value_from.secret_key_ref.name:
Permission denied on secret: projects/xxxxx/secrets/db-password/versions/latest for Revision
service account xxxxxxxxxx-compute@developer.gserviceaccount.com. The service account used
must be granted the 'Secret Manager Secret Accessor' role.
```

**原因:** Cloud Runの実行サービスアカウント(`xxxxx-compute@developer.gserviceaccount.com`)に、Secret Managerの読み取り権限が付与されていなかった。

**対処法:** 使用するSecretそれぞれに対して権限を個別付与する。

```bash
gcloud secrets add-iam-policy-binding db-password \
  --member="serviceAccount:xxxxxxxxxx-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding laravel-app-key \
  --member="serviceAccount:xxxxxxxxxx-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

権限反映まで数十秒かかることがあるため、少し時間を置いてから再デプロイする。

### チェックリスト

- [ ] デプロイに使うサービスアカウントには、使用するリソース(Secret Manager、Cloud SQLなど)ごとに個別の権限付与が必要と想定しておく

---

## 3. Cloud Runでコンテナが起動しない(ポート8080でリッスンせずタイムアウト)

このエラーメッセージ自体は表面的な症状に過ぎず、真因は毎回異なる。**必ずログを見て根本原因を特定する。**

```bash
gcloud run services logs read job-manager-api --region=asia-northeast1 --limit=100
```

### ケース1: PHPバージョン不一致

**原因:** `composer.json`がPHP 8.4以上を要求しているのに、Dockerfileの実行イメージが`php:8.3-cli-alpine`だった。

**対処法:** Dockerfileのベースイメージを`php:8.4-cli-alpine`に変更する。PHPバージョンとcomposerの要求は常にセットで確認する。

### ケース2: マイグレーション失敗によるサーバー起動停止

**原因:** `entrypoint.sh`内の`php artisan migrate --force`がDB認証エラーで失敗し、`set -e`によりその後の`php artisan serve`が実行されなかった(根本原因は「4. DB接続エラー」を参照)。

**対処法(このプロジェクトで採用した方針):** マイグレーションが失敗してもサーバー自体は起動できるよう、`entrypoint.sh`を以下のように変更した。

```bash
php artisan migrate --force || echo "MIGRATION FAILED - continuing anyway"
```

これにより、マイグレーションが失敗してもコンテナはポート8080でリッスンし続け、Cloud Runのヘルスチェックには通る(DBを使うエンドポイントは個別に500を返す形になるので、切り分けがしやすくなる)。**マイグレーション自体の失敗を無視してよいわけではない**ので、根本原因は別途必ず解消すること。

### チェックリスト

- [ ] Dockerfile変更時は`composer.json`の`require.php`とベースイメージのPHPバージョンが一致しているか確認する
- [ ] `entrypoint.sh`で`set -e`を使う場合、DB接続を伴うコマンド(migrateなど)が失敗するとサーバー起動自体が止まる点を意識する
- [ ] 起動失敗時は必ず`gcloud run services logs read`で最新ログを確認する(複数回分のログが混在することがあるので、タイムスタンプで最新を判断する)

---

## 4. DB接続エラー(`Access denied for user`)

### 症状

```
SQLSTATE[HY000] [1045] Access denied for user 'job_manager_app'@'cloudsqlproxy~...' (using password: YES)
```

がログに継続的に出力され、`SESSION_DRIVER=database` / `CACHE_STORE=database`を使っているため、ほぼ全リクエストが500エラーになる。

**原因:** Secret Manager(`db-password`)に登録されているパスワードと、Cloud SQL側の`job_manager_app`ユーザーに実際に設定されているパスワードが一致していなかった(「1. Cloud SQLインスタンス構築」で`set-password`が403エラーで失敗しており、DB側は古いパスワードのままだった)。

**対処法:** Cloud SQL側のパスワードを新規発行し、Secret Managerの値もそれに合わせて更新する(=値を一致させる)。

```bash
NEW_PASSWORD=$(openssl rand -base64 24)

gcloud sql users set-password job_manager_app \
  --instance=job-manager-db \
  --password="$NEW_PASSWORD"

echo -n "$NEW_PASSWORD" | gcloud secrets versions add db-password --data-file=-
```

Secretを更新したら、Cloud Runに新しいリビジョンを起動させて反映する。

```bash
gcloud run services update job-manager-api \
  --region=asia-northeast1 \
  --update-secrets="DB_PASSWORD=db-password:latest"
```

**重要:** Secret Managerで新しいバージョンを作っただけでは、既に動いているコンテナには反映されない。必ず上記のように新しいリビジョンを作らせる操作が必要(詳しくは「全体を通しての教訓」参照)。

### チェックリスト

- [ ] Secret Managerのパスワードと実際のDBユーザーのパスワードは「常に同期しているか」をデプロイ前に確認する

---

## 5. Firebase Hostingのセットアップ

### 症状: `firebase deploy`で`No currently active project`

**原因:** Firebaseのアクティブプロジェクトが未設定。

**対処法:** `firebase use --add`でプロジェクトを選択・紐付ける。

### 症状: `firebase projects:list`で`No projects found`

**原因:** GCPプロジェクトは存在するが、Firebaseがまだ関連付けられていなかった。

**対処法:** `firebase projects:addfirebase <project-id>`で追加を試みる。

### 症状: `firebase projects:addfirebase`が403 `PERMISSION_DENIED`

**原因:** Firebase Management APIが有効化されていなかった。**API有効化後、ログアウト・再ログインしても解消しないケースがあった。**

**対処法:** CLIに固執せず、**Firebase Console**から「プロジェクトを追加」→既存のGCPプロジェクトIDを入力して追加する。CLI経由の同意フロー処理には制約がある場合があり、Console側でしか完了できないことがある。

### チェックリスト

- [ ] `gcloud services enable firebase.googleapis.com firebasehosting.googleapis.com` を先に実行しておく
- [ ] **そもそもFirebaseプロジェクトは`firebase init hosting`のCLIフローより先に、Firebase Consoleで作る方が簡単。** その際「既存のGoogle Cloudプロジェクトに追加」を選び、Cloud Runと同じGCPプロジェクトに紐付けること
- [ ] CLIで403が解消しない場合は、早めにFirebase Consoleから既存GCPプロジェクトへの追加を試す(CLIに固執しない)
- [ ] `frontend/.env.production`はビルド前(`npm run build`前)に作成する。バックエンドURLは`gcloud run services describe <service> --region=<region> --format="value(status.url)"`で取得できる
- [ ] `firebase deploy --only hosting`は`--project <PROJECT_ID>`を明示しないと失敗することがある(`firebase init`で選択済みでも省略できない場合がある)
- [ ] GitHub Actions連携(「Set up automatic builds and deploys with GitHub?」)は初回デプロイ時はNoでよい。手動デプロイが安定してから後日`firebase init hosting:github`で追加できる

---

## 6. Firebase Hostingでウェルカムページが表示される

### 症状

デプロイ後にアプリではなく「Firebase Hosting Setup Complete」の初期画面が表示される。

**原因:** `firebase.json`の`public`が`dist`(Viteのビルド出力先)ではなく`public`(Firebase CLIが自動生成したデフォルトのプレースホルダー用フォルダ)になっていた。`firebase init hosting`を実行するタイミングによっては、意図した設定が上書きされることがある。

**対処法:** `firebase.json`を確認し、`public`を`dist`に修正して再デプロイする。

```json
{
  "hosting": {
    "public": "dist"
  }
}
```

```bash
firebase deploy --only hosting
```

デプロイ後は必ず実際の画面を確認し、`firebase.json`の`public`の値を都度チェックする習慣をつけるとよい。

---

## 7. CORSエラー(`No 'Access-Control-Allow-Origin' header`)

このエラーは1つの原因ではなく、**複数の要因が積み重なって**発生することが多い。原因ごとに切り分ける必要がある。

### 7-1. `FRONTEND_URL` / `APP_URL` の環境変数未設定

**原因:** LaravelのCORS設定が許可オリジンとして`FRONTEND_URL`環境変数を参照する実装になっていたが、Cloud Runデプロイ時にこの環境変数を設定していなかった。

**対処法:**

```bash
gcloud run services update job-manager-api \
  --region=asia-northeast1 \
  --update-env-vars="FRONTEND_URL=<FRONTEND_URL>,APP_URL=<API_URL>"
```

### 7-2. APIリクエストURLの二重スラッシュ

**症状:** `https://job-manager-api-xxxxx.asia-northeast1.run.app//access-check` のように、ドメインの直後が`//`になっていた。

**原因:** フロントエンドの`.env.production`の`VITE_API_BASE_URL`の**末尾にスラッシュが付いていた**ため、コード側でパスと結合した際に`//`になっていた。404レスポンスにはCORSヘッダーが付与されないため、ブラウザ上では「CORSでブロックされた」というエラー表示になっていた(実体はルーティング不一致による404)。

**対処法:** `.env.production`の末尾スラッシュを削除する。

```
VITE_API_BASE_URL=https://job-manager-api-xxxxx.asia-northeast1.run.app/api
```

修正後は必ず再ビルド・再デプロイする(Viteは`.env.production`の値をビルド時に埋め込むため、値を変えただけでは反映されない)。

```bash
cd frontend
npm run build
firebase deploy --only hosting
```

### 7-3. `config/cors.php`の`paths`に対象パスが含まれていない

**症状:** 特定のエンドポイント(`/access-check`)へのOPTIONSプリフライトリクエストが404になる。

**原因:** `config/cors.php`の`paths`設定が`api/*`のみになっており、`/access-check`のように`api/`プレフィックス外のパスがCORSミドルウェアの対象外になっていた。

**対処法:** `paths`に対象パスを明示的に追加する。

```php
'paths' => ['api/*', 'access-check', 'sanctum/csrf-cookie'],
```

**重要:** バックエンドのコード(config含む)を変更した場合、環境変数の更新(`services update`)だけでは反映されない。必ず`gcloud run deploy --source .`でイメージを再ビルド・再デプロイする必要がある。

---

## 8. `/api`プレフィックスの付け忘れ(404)

**原因:** Laravel 11以降、`bootstrap/app.php`の`withRouting(api: __DIR__.'/../routes/api.php', ...)`により、`routes/api.php`に定義したルートは自動的に`/api`プレフィックスが付与される。一方、フロントエンドの`VITE_API_BASE_URL`から`/api`が抜けていたため、実際には存在しない`/access-check`(`/api`なし)にリクエストしていた。

**対処法:** `.env.production`の値に`/api`を含める(7-2と同じ形の修正)。

```
VITE_API_BASE_URL=https://job-manager-api-xxxxx.asia-northeast1.run.app/api
```

修正後は再ビルド・再デプロイが必須。

---

## 9. `gcloud run deploy`コマンドの構文ミス

**症状:** `--set-env-vars`の各値を個別に`""`で囲んでいたため、コマンド全体の引用符の対応が崩れ、意図しない箇所でコマンドが分割される・エラーになる。

誤った例:

```bash
--set-env-vars="...,ACCESS_KEY="xxxxxx",ACCESS_KEY_EXPIRES_AT="2026-09-30 23:59:59"
```

**対処法:** 外側を1つの`""`で囲むだけにし、個々の値には引用符を付けない。値にスペースが含まれていても、全体が1つの`""`で囲まれていれば問題ない。

```bash
--set-env-vars="APP_ENV=production,...,ACCESS_KEY=xxxxxx,ACCESS_KEY_EXPIRES_AT=2026-09-30 23:59:59,FRONTEND_URL=<FRONTEND_URL>,APP_URL=<API_URL>"
```

---

## 全体を通しての教訓

### 変更対象ごとに必要な反映作業

| 変更した対象 | 反映に必要な作業 |
| --- | --- |
| フロントエンドの`.env.production` | `npm run build` → `firebase deploy --only hosting` |
| フロントエンドのソースコード | `npm run build` → `firebase deploy --only hosting` |
| バックエンドのコード・config(`config/cors.php`等) | `gcloud run deploy --source .`(再ビルド必須。環境変数の`update`では反映されない) |
| バックエンドの環境変数のみ | `gcloud run services update --update-env-vars=...`(軽量。コードの再ビルド不要) |
| Secretの値 | Secret更新後、Cloud Runに新しいリビジョンを作らせる必要がある(`services update --update-secrets=...`) |

### 特に意識すべき点

1. **`gcloud run deploy --source .`は環境変数をフルセットで上書きする。** 一度`services update --update-env-vars`で個別に追加した環境変数(`FRONTEND_URL`, `APP_URL`など)があっても、次に`gcloud run deploy --source .`を実行する際に指定し忘れると消えてしまう。コード変更のたびに実行するデプロイコマンドには、**それまでに追加した環境変数もすべて含める**こと。
2. **CORSエラーの多くは「本当はCORSではない」ことがある。** 404や500エラーのレスポンスにはCORSヘッダーが付与されないため、ブラウザのConsoleには「CORSポリシーでブロックされた」と表示される。実際の原因(ルーティングミス、サーバー内部エラー)を切り分けるには、Cloud Runのログを必ず確認する。
3. **各作成コマンド実行後は「本当に作られたか」を`list`や`describe`で確認する習慣をつける。** gcloud/firebaseのコマンドはエラーメッセージが分かりにくいまま失敗することがある。
4. **権限エラー(403)は「認証はできているが権限がない」ことを意味する。** IAMロールだけでなく、対象APIが有効化されているか、CLI側の制約がないかも合わせて疑う。
5. **パスワード管理はSecret Manager一元化が有効。** ただし「Secret Managerの値」と「実際のリソース(DBユーザーなど)に設定されている値」が同期しているかは都度確認が必要。Secret Managerの値を更新しただけでは実行中のコンテナには反映されない(新しいリビジョンの作成が必要。詳細は[access-key-guide.md](access-key-guide.md)でも触れている)。
6. **コンテナの起動失敗は、まずログを見る。** 「ポートでリッスンしない」というCloud Runのエラーメッセージは表面的な症状に過ぎない。真因(PHPバージョン不一致、DB接続失敗など)はログの中にある。
7. **CLIで詰まったらConsole UIを試す。** 特にFirebaseの初回セットアップ系は、CLIでは処理しきれない同意フローがConsole側にのみ存在することがある。
8. **プロジェクトID/プロジェクト番号は完全な機密情報ではないが、公開の場に貼る際は伏せ字にする習慣をつけると安心。** 真に守るべきはパスワードやAPIキーなどの認証情報。

### 切り分けの基本フロー

1. ブラウザの開発者ツール(Console / Networkタブ)でエラーの実体(ステータスコード、リクエストURL)を確認する
2. Cloud Runのログ(`gcloud run services logs read job-manager-api --region=asia-northeast1 --limit=50`)でサーバー側のエラーを確認する
3. フロントエンドとバックエンドのURL・パスの対応関係(`/api`プレフィックスの有無、末尾スラッシュ等)を突き合わせる

### 役立ったデバッグコマンド集

```bash
# Cloud Runのログを確認
gcloud run services logs read job-manager-api --region=asia-northeast1 --limit=50

# 現在の環境変数を確認
gcloud run services describe job-manager-api \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.containers[0].env)"

# CORSプリフライトの挙動を直接確認
curl -i -X OPTIONS "<API_URL>/api/access-check" \
  -H "Origin: <FRONTEND_URL>" \
  -H "Access-Control-Request-Method: GET"

# Secret Managerの値を確認
gcloud secrets versions access latest --secret="db-password"

# Cloud SQLインスタンスの存在確認
gcloud sql instances list

# 現在のプロジェクトの課金有効状態を確認
gcloud billing projects describe $(gcloud config get-value project)
```

---

*関連ドキュメント: [deploy-gcp.md](deploy-gcp.md)(デプロイ手順書)、[access-key-guide.md](access-key-guide.md)(アクセスキー保護の詳細)*
