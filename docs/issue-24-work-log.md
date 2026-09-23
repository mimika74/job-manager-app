# Issue #24 作業ログ: 一覧⇄カンバンのデータ同期テストを追加する

[GitHub Issue #24](https://github.com/mimika74/job-manager-app/issues/24)

## 目的

#20〜#23で一覧・カンバンの両方から求人の閲覧・登録・編集・削除・ステータス変更ができるようになった。両者は同じ`jobs`データ(`JobListPage`が持つstate)を参照する設計になっているが、モーダル化(#23)によって一覧・カンバン間の同期を手動の`onJobsChanged`呼び出しに頼る箇所も生まれたため、この同期が壊れていないことを自動テストで担保する。

## 実装アプローチ

バックエンド(PHPUnit)のテストは既にあったが、フロントエンドには自動テストの仕組みが一切なかったため、今回初めて導入した。

- テスト実行エンジン: **Vitest**(Viteと同じ設定・変換パイプラインを使えるため、追加設定が少なく済む)
- コンポーネントの描画・操作: **React Testing Library**(`@testing-library/react` / `@testing-library/user-event`)
- 実行環境: **jsdom**(ブラウザを模した軽量なDOM環境)

テストでは実際のバックエンドを起動せず、`frontend/src/api/jobs.ts`が輸出する関数(`fetchJobs`・`createJob`・`updateJob`・`updateJobStatus`・`deleteJob`・`fetchJob`)を`vi.mock`で丸ごと偽物に差し替え、戻り値をテストごとに自由に設定している。

---

## 作成・変更したファイル

| ファイル | 内容 |
| --- | --- |
| [frontend/package.json](../frontend/package.json) | `vitest` / `@testing-library/react` / `@testing-library/jest-dom` / `@testing-library/user-event` / `jsdom`を devDependencies に追加。`npm run test`スクリプトを追加 |
| [frontend/vite.config.ts](../frontend/vite.config.ts) | `defineConfig`のimport元を`vite`から`vitest/config`に変更し、`test`設定(`environment: 'jsdom'`、`setupFiles`、`globals: true`)を追加 |
| [frontend/src/setupTests.ts](../frontend/src/setupTests.ts) | 新規作成。`@testing-library/jest-dom/vitest`を読み込み、`toBeInTheDocument()`などの追加マッチャーを有効化 |
| [frontend/src/pages/JobListPage.test.tsx](../frontend/src/pages/JobListPage.test.tsx) | 新規作成。受け入れ条件5つに対応する5本のテスト |

---

## 実装のポイント

### APIのモック

`vi.mock('../api/jobs', () => ({ ... }))`で、実際にネットワーク通信する関数群を`vi.fn()`に差し替えている。`ApiValidationError`のようなクラスも、`instanceof`判定に使われるため同じモジュール内に含めて用意している。各テストでは`vi.mocked(fetchJobs).mockResolvedValueOnce([...])`のように「次に1回呼ばれたときだけこれを返す」を積み重ねることで、「初回読み込み時」「操作後の再取得時」で異なるデータを返すシナリオを表現している。

### ドラッグ&ドロップの再現

jsdomには本物の`DataTransfer`が実装されていないため、`JobKanbanView`が実際に呼び出している`setData`/`getData`の2メソッドだけを持つ最小限の偽オブジェクトを自作し、`fireEvent.dragStart` / `dragOver` / `drop`にそのつど渡すことで、`draggable`カードの操作を再現している。

### 2種類の描画パターン

- カンバン内のモーダル編集・新規登録・ステータス変更のみを確認するテストは`<JobListPage />`単体を`<MemoryRouter>`で包んで描画
- 一覧の「編集」リンク経由の編集・削除(ページ遷移が伴うもの)を確認するテストは、ルーティングごと検証する必要があるため`<App />`全体を描画している

### 状態の不在を確認する

「片方で削除すると、もう片方からも消える」「失敗時に元に戻る」の検証では、`getByText`(見つからないとテスト自体がエラーになる)ではなく`queryByText`(見つからなければ`null`を返すだけ)を使い、`expect(...).not.toBeInTheDocument()`という形で「存在しないこと」を確認している。

---

## 動作確認方法

```bash
cd frontend
npm run test
npx tsc --noEmit -p tsconfig.app.json
```

## 確認結果

| # | 受け入れ条件 | テスト名 |
| --- | --- | --- |
| 1 | 一覧で追加した求人がカンバンに表示される | `一覧で追加した求人がカンバンに表示される` |
| 2 | カンバンで状態変更すると一覧にも反映される | `カンバンで状態変更すると一覧にも反映される` |
| 3 | 一覧で編集するとカンバンカードも更新される | `一覧で編集するとカンバンカードも更新される` |
| 4 | 片方で削除すると、もう片方からも消える | `片方で削除すると、もう片方からも消える` |
| 5 | API失敗時に画面だけ変更された状態が残らない | `API失敗時に画面だけ変更された状態が残らない` |

`npm run test` → 5 passed(5)。`npx tsc --noEmit` → エラーなし。

---

## 次段階

[#25 開発環境と本番環境を分離する](https://github.com/mimika74/job-manager-app/issues/25) に進む。
