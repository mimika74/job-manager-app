# Day3 作業ログ: React(Vite+TypeScript)環境構築 + API疎通確認 + 一覧画面(GET表示)

## 目的

`frontend/` にReact(Vite + TypeScript)プロジェクトを構築し、Day2で作ったLaravel API(`GET /api/jobs`)に対して実際にブラウザからfetchし、求人一覧をテーブル表示する。あわせて、別途用意したデザインモックアップ(セキュリティ監視ダッシュボード)のデザイントークン(配色・タイポグラフィ・カード/バッジのスタイル)を踏襲した見た目に整えた。

対象要件: [requirements.md](requirements.md) の「画面一覧」のうち、求人一覧画面の最初のステップ(一覧表示のみ、新規登録・編集画面は次段階)。

途中でJavaScriptからTypeScriptに変更したため、最初に作った `--template react` 版は破棄し、`--template react-ts` で作り直した。

---

## 作成・変更したファイル

| ファイル | 内容 |
| --- | --- |
| `frontend/` 一式 | `npm create vite@latest frontend -- --template react-ts` で生成したベースプロジェクト(tsconfig一式、`vite.config.ts` 含む) |
| [frontend/.env](../frontend/.env) / [frontend/.env.example](../frontend/.env.example) | APIのベースURL(`VITE_API_BASE_URL`)。`.env` はgitignore対象 |
| [frontend/src/types/job.ts](../frontend/src/types/job.ts) | `Job` インターフェース、`JobStatus` 型(9段階のUnion型)、`JOB_STATUSES` 定数 |
| [frontend/src/api/jobs.ts](../frontend/src/api/jobs.ts) | `fetchJobs(): Promise<Job[]>` — 型付きfetchラッパー |
| [frontend/src/components/StatusBadge.tsx](../frontend/src/components/StatusBadge.tsx) | ステータス値に応じて色分けするバッジコンポーネント |
| [frontend/src/pages/JobListPage.tsx](../frontend/src/pages/JobListPage.tsx) | 一覧画面。loading/error/空/成功の4状態を出し分けてテーブル表示 |
| [frontend/src/App.tsx](../frontend/src/App.tsx) | ヘッダー(ブランドマーク+タイトル)+ `JobListPage` + フッターのレイアウト |
| [frontend/src/index.css](../frontend/src/index.css) | デザイントークン(CSS変数)定義。配色・フォント・ドット柄の背景など |
| [frontend/src/App.css](../frontend/src/App.css) | ヘッダー・カード・テーブル・バッジのスタイル |
| [frontend/index.html](../frontend/index.html) | Google Fonts(Zen Kaku Gothic New / JetBrains Mono)の読み込み、タイトルを日本語化 |
| `frontend/src/assets/*`, `frontend/public/icons.svg` | Viteテンプレートの未使用画像を削除 |
| [.claude/launch.json](../.claude/launch.json) | プレビュー起動用設定(`npm --prefix frontend run dev` をポート5173で起動) |

---

## 手動で行う場合の手順

### 1. Vite + TypeScriptプロジェクトを作成

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

**注意点(Windows特有):** Git Bash上で `npm create vite@...` や `npx ...` を実行すると `'"node"' は、内部コマンドまたは外部コマンド...として認識されていません` というエラーになり失敗する。npxが内部で呼び出す `cmd.exe` サブプロセスのPATHにNode.jsのインストールパスが正しく渡っていないことが原因と見られる。**PowerShellから同じコマンドを実行すると問題なく成功する**ため、npm/npx系のコマンドはPowerShellで実行するのが安定する(Day2の `newman` 実行時にも同じ現象が発生していた)。

`react-ts` テンプレートには `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` が自動生成され、`tsconfig.app.json` に `"types": ["vite/client"]` が含まれているため、`import.meta.env.VITE_API_BASE_URL` が型エラーなく使える(`vite-env.d.ts` を手動で足す必要はなかった)。

### 2. 型定義とAPIクライアント

`frontend/src/types/job.ts` にバックエンドの `Job` モデル([Job.php](../backend/app/Models/Job.php))と対応する型を定義:

```ts
export const JOB_STATUSES = ['未応募', '応募済', ...] as const
export type JobStatus = (typeof JOB_STATUSES)[number]
export interface Job {
  id: number
  company_name: string
  // ...
  status: JobStatus
}
```

`frontend/src/api/jobs.ts` で `fetchJobs(): Promise<Job[]>` を実装。レスポンス型・エラー型をジェネリクスで扱う。

### 3. 一覧ページ・バッジコンポーネント

`JobListPage.tsx` で `useState<Job[]>` / `useState<'loading'|'success'|'error'>` を使い分け、`StatusBadge.tsx` でステータス文字列をトーン(loss/gold/info/profit/accent2/neutral)にマッピングして色付きバッジ表示する。

### 4. デザインをモックアップに合わせる

添付されたセキュリティダッシュボードのHTML(単一ファイル、CSS変数でトークン定義)からデザイン言語を抽出し、`index.css` に移植:

- 配色: `--paper`(生成りの背景)、`--ink`(本文色)、`--gold`/`--loss`/`--profit`/`--info`/`--accent2`(状態別アクセントカラー)
- タイポグラフィ: 見出し・本文は「Zen Kaku Gothic New」、数値・日付・給与などは等幅の「JetBrains Mono」(Google Fontsから読み込み)
- カード: `border-radius:14px` + 淡いシャドウ、テーブルヘッダーは濃紺背景+生成り文字
- バッジ: 元デザインの重要度バッジ(HIGH/MEDIUM/LOW)の配色パターンを、求人ステータス9段階にマッピングし直した(内定=緑、不採用=赤、選考中系=金、応募済=青、最終面接=紫、未応募/辞退=グレー)

元のHTMLはセキュリティ監視ダッシュボード固有の機能(タブ切り替え、フィルタ、ページネーション等)を含んでいたが、それらは移植せず、デザイントークンとカード/テーブル/バッジのスタイルのみを踏襲した(Day3のスコープはあくまで一覧表示のため)。

---

## 動作確認方法

### バックエンドを起動

```bash
cd backend
php artisan serve
```

### フロントエンドを起動

```bash
cd frontend
npm run dev
```

`http://localhost:5173` を開き、ヘッダー+カード風テーブルで求人一覧が表示されることを確認する。

### 型チェック・ビルド確認

```bash
cd frontend
npx tsc --noEmit -p tsconfig.app.json   # 型エラーがないことを確認
npm run build                            # tsc -b && vite build が通ることを確認
```

### 確認結果

- `npx tsc --noEmit` / `npm run build` ともにエラーなく成功
- ブラウザのNetworkタブで `GET http://127.0.0.1:8000/api/jobs` が `200 OK`
- コンソールエラー・CORSエラーなし
- Postmanで登録済みだった求人データがステータスバッジ付きテーブルで表示されることを確認

**気づいた点:** 開発時、Reactの `StrictMode`(`main.tsx` で有効)により `useEffect` が2回実行され、`GET /api/jobs` がNetworkタブに2回記録される。開発モードのみの挙動で本番ビルドでは1回しか実行されないため、今回は特に対処していない(Day2の作業ログにも同様の記載あり)。

---

## 未対応・次段階(Day4以降の候補)

- 新規登録・編集フォーム画面(`JobFormPage`)
- 一覧からフォーム画面への画面遷移(ルーティング導入)
- ステータス変更・削除の実操作(現状はGETのみ)
