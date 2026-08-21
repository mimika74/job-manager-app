# 設計メモ

## ディレクトリ構成

```
project-root/
├── backend/                      # Laravel
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/
│   │   │   │   └── Api/
│   │   │   │       └── JobController.php
│   │   │   └── Requests/
│   │   │       ├── StoreJobRequest.php
│   │   │       └── UpdateJobRequest.php
│   │   └── Models/
│   │       └── Job.php
│   ├── database/
│   │   ├── migrations/
│   │   │   └── xxxx_create_jobs_table.php
│   │   └── database.sqlite       # SQLite使用時
│   ├── routes/
│   │   └── api.php
│   └── .env
│
└── frontend/                     # React (Vite)
    ├── src/
    │   ├── api/
    │   │   └── jobs.js           # fetchラッパー(axios等)
    │   ├── components/
    │   │   ├── JobCard.jsx
    │   │   └── StatusBadge.jsx
    │   ├── pages/
    │   │   ├── JobListPage.jsx
    │   │   └── JobFormPage.jsx   # 新規登録/編集 兼用
    │   ├── App.jsx
    │   └── main.jsx
    └── vite.config.js
```

---

## DBテーブル

### jobs テーブル

| カラム名         | 型                          | 備考                          |
| ---------------- | --------------------------- | ----------------------------- |
| id               | bigint (PK, auto increment) |                               |
| company_name     | varchar                     | NOT NULL                      |
| position         | varchar                     | NOT NULL                      |
| status           | varchar                     | NOT NULL, デフォルト '未応募' |
| application_date | date                        | NULL可                        |
| url              | varchar                     | NULL可                        |
| location         | varchar                     | NULL可                        |
| salary_min       | integer                     | NULL可(万円単位)              |
| salary_max       | integer                     | NULL可(万円単位)              |
| memo             | text                        | NULL可                        |
| created_at       | timestamp                   | Laravel標準                   |
| updated_at       | timestamp                   | Laravel標準                   |

ステータスは以下9段階。DB上はvarcharとし、Laravel側のFormRequestで許可値をバリデーションする。

1. 未応募
2. 応募済
3. 書類選考中
4. 一次面接
5. 二次面接
6. 最終面接
7. 内定
8. 不採用
9. 辞退

---

## APIエンドポイント

`Route::apiResource('jobs', JobController::class)` によるRESTful構成。

| メソッド  | パス           | 内容                               |
| --------- | -------------- | ---------------------------------- |
| GET       | /api/jobs      | 一覧取得                           |
| POST      | /api/jobs      | 新規登録                           |
| GET       | /api/jobs/{id} | 詳細取得                           |
| PUT/PATCH | /api/jobs/{id} | 更新(ステータス変更・メモ編集含む) |
| DELETE    | /api/jobs/{id} | 削除(任意)                         |
