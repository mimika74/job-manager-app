# GCPデプロイ手順書

構成: **Cloud Run**(Laravel API)+ **Cloud SQL for MySQL**(DB)+ **Firebase Hosting**(React静的ファイル)

以降のコマンドはすべて `gcloud`(Googleアカウントでの認証が必要)を使うため、**Phase 0・1はご自身のブラウザ・ターミナルで実行してください**。それ以降は基本コピペで進められます。

---

## Phase 0: GCPプロジェクトを作る(ブラウザ操作)

1. https://console.cloud.google.com/ にアクセスし、Googleアカウントでログイン
2. 画面上部のプロジェクト選択 →「新しいプロジェクト」
3. プロジェクト名を入力(例: `job-manager-app`)して作成。**表示される「プロジェクトID」を控えておく**(以降 `<PROJECT_ID>` と書いている箇所に使う)
4. 「お支払い」から請求先アカウントを設定(クレジットカード登録が必要。Cloud Run・Cloud SQLとも無料枠があるが、登録自体は必須)

---

## Phase 1: gcloud CLIをインストール・ログイン

1. https://cloud.google.com/sdk/docs/install からWindows用インストーラを取得してインストール
2. インストール後、**新しいPowerShellを開いて**:

```powershell
gcloud init
```

画面の指示に従いブラウザでログイン→Phase 0で作ったプロジェクトを選択します。

3. 念のためプロジェクトを明示的に設定:

```powershell
gcloud config set project <PROJECT_ID>
```

---

## Phase 2: 必要なAPIを有効化

```bash
gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

---

## Phase 3: Cloud SQL(MySQL)インスタンスを作成

```bash
gcloud sql instances create job-manager-db \
  --database-version=MYSQL_8_0 \
  --tier=db-f1-micro \
  --region=asia-northeast1 \
  --root-password=<rootパスワードを決めて入力>

gcloud sql databases create job_manager --instance=job-manager-db

gcloud sql users create job_manager_app \
  --instance=job-manager-db \
  --password=<アプリ用パスワードを決めて入力>
```

接続名(後で使う)を控える:

```bash
gcloud sql instances describe job-manager-db --format="value(connectionName)"
# 例: my-project-123:asia-northeast1:job-manager-db
```

以降、この値を `<CONNECTION_NAME>` と表記します。

---

## Phase 4: APP_KEYとDBパスワードをSecret Managerに登録

ローカルで一度だけAPP_KEYを生成(**このコマンドは`backend`ディレクトリでローカル実行**、既存の`.env`は上書きされない):

```bash
php artisan key:generate --show
# base64:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx= のような文字列が出力される
```

出力された文字列をコピーし、Secret Managerに登録:

```bash
echo -n "base64:xxxxxxxxx...(上でコピーした値)" | gcloud secrets create laravel-app-key --data-file=-
echo -n "<Phase3で決めたアプリ用パスワード>" | gcloud secrets create db-password --data-file=-
```

---

## Phase 5: バックエンドをCloud Runにデプロイ

`backend` ディレクトリで実行(Dockerfileはこのリポジトリに用意済み):

```bash
cd backend

gcloud run deploy job-manager-api \
  --source . \
  --region=asia-northeast1 \
  --allow-unauthenticated \
  --add-cloudsql-instances=<CONNECTION_NAME> \
  --set-env-vars="APP_ENV=production,APP_DEBUG=false,APP_LOCALE=ja,APP_FALLBACK_LOCALE=en,DB_CONNECTION=mysql,DB_DATABASE=job_manager,DB_USERNAME=job_manager_app,DB_SOCKET=/cloudsql/<CONNECTION_NAME>,SESSION_DRIVER=database,CACHE_STORE=database,QUEUE_CONNECTION=database" \
  --set-secrets="APP_KEY=laravel-app-key:latest,DB_PASSWORD=db-password:latest"
```

初回はビルドに数分かかります。完了すると `https://job-manager-api-xxxxx-an.a.run.app` のようなURLが表示されるので控えておく(以降 `<API_URL>`)。

動作確認:

```bash
curl <API_URL>/api/jobs
```

`[]` または既存データのJSONが返ってくればOKです。

---

## Phase 6: フロントエンドをFirebase Hostingにデプロイ

Firebase HostingはGCPプロジェクトにそのまま紐付けられます(裏側は同じGoogle Cloudプロジェクト)。

```bash
npm install -g firebase-tools   # 初回のみ
firebase login
```

`frontend` ディレクトリで:

```bash
cd frontend
firebase init hosting
```

- 「Use an existing project」→ Phase 0で作ったプロジェクトを選択
- public directory は `dist` (このリポジトリの `firebase.json` に設定済みなので、初期化時に上書き確認が出たら **既存のfirebase.jsonを保持** を選ぶ)
- 「Configure as a single-page app」= **Yes**

APIの向き先を本番URLに変更するため、`frontend/.env.production` を作成:

```
VITE_API_BASE_URL=<API_URL>/api
```

ビルド&デプロイ:

```bash
npm run build
firebase deploy --only hosting
```

`https://<project-id>.web.app` のようなURLが表示されます(以降 `<FRONTEND_URL>`)。

---

## Phase 7: CORSを本番URLだけに絞る

`config/cors.php` は `FRONTEND_URL` 環境変数で許可オリジンを絞れるようになっています。Cloud Run側に設定を追加:

```bash
gcloud run services update job-manager-api \
  --region=asia-northeast1 \
  --update-env-vars="FRONTEND_URL=<FRONTEND_URL>,APP_URL=<API_URL>"
```

---

## Phase 8: 最終確認

`<FRONTEND_URL>` をブラウザで開き、一覧表示・新規登録・編集・削除がすべて本番のCloud SQL上のデータに対して動作することを確認してください。

---

## 2回目以降の更新デプロイ

コードを変更したら、以下を実行するだけです。

```bash
# バックエンド
cd backend
gcloud run deploy job-manager-api --source . --region=asia-northeast1

# フロントエンド
cd frontend
npm run build
firebase deploy --only hosting
```

---

## 料金について

- Cloud Run: リクエストが来た時だけ課金。アクセスが少なければ無料枠内に収まることが多い
- Cloud SQL: **常時起動**のため無料枠を使い切ると継続課金される。使わない期間は停止できる:
  ```bash
  gcloud sql instances patch job-manager-db --activation-policy=NEVER
  ```
  再開する時:
  ```bash
  gcloud sql instances patch job-manager-db --activation-policy=ALWAYS
  ```
- 完全に不要になったら削除:
  ```bash
  gcloud sql instances delete job-manager-db
  gcloud run services delete job-manager-api --region=asia-northeast1
  ```

---

## トラブルシューティング

| 症状 | 確認ポイント |
| --- | --- |
| Cloud Runデプロイ後、APIが500を返す | `gcloud run services logs read job-manager-api --region=asia-northeast1` でログ確認。`APP_KEY`未設定・DB接続情報の誤りが多い |
| フロントから叩くとCORSエラー | `FRONTEND_URL` がCloud Runの環境変数に正しく設定されているか確認(`https://`込みで完全一致している必要あり) |
| マイグレーションが失敗する | Cloud SQLインスタンスとCloud Runの`--add-cloudsql-instances`の接続名が一致しているか確認 |
