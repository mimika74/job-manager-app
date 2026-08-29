# Day1 作業ログ: Laravel環境構築、SQLite設定、jobsマイグレーション作成・実行、Jobモデル作成

## このログについて

Day1は、このセッションとは別の対話(Claude Codeとのやり取り)で実施された。このログはその実際の会話内容をもとに、後から見て同じ手順を再現できるようにまとめたもの。

## 目的

Laravelのバックエンド環境を新規構築し、求人データを保存するテーブルとモデルを用意する。あわせて、開発中にDBの中身を目視確認できるツール(DB Browser for SQLite)を導入する。

---

## 手順

### 1. Laravel環境構築

PHPとComposerが入っている前提で、`project-root/` 直下で実行する。

```bash
composer create-project laravel/laravel backend
cd backend
php artisan serve
```

`http://localhost:8000` を開いてLaravelのウェルカム画面が出れば成功。確認できたら `Ctrl+C` でサーバーを止める。

**補足:** Laravel 11以降のインストーラーではDB選択を聞かれることがあり、そこで「sqlite」を選ぶと次のSQLite設定が自動で済んでいる場合がある。

### 2. SQLite設定

```bash
touch database/database.sqlite
```

`.env` を開いて `DB_CONNECTION=sqlite` になっているか確認する。`DB_HOST` や `DB_DATABASE` などの行はコメントアウト(またはそのまま放置でも動く。`sqlite` 指定時、Laravelは `database/database.sqlite` を自動で見る)。

### 3. jobsマイグレーション作成 + Jobモデル作成

1コマンドで同時に作成できる。

```bash
php artisan make:model Job -m
```

生成された `database/migrations/xxxx_xx_xx_create_jobs_table.php` の `up()` を以下に置き換える。

```php
public function up(): void
{
    Schema::create('jobs', function (Blueprint $table) {
        $table->id();
        $table->string('company_name');
        $table->string('position');
        $table->string('status')->default('未応募');
        $table->date('application_date')->nullable();
        $table->string('url')->nullable();
        $table->string('location')->nullable();
        $table->integer('salary_min')->nullable();
        $table->integer('salary_max')->nullable();
        $table->text('memo')->nullable();
        $table->timestamps();
    });
}
```

保存したらマイグレーションを実行する。

```bash
php artisan migrate
```

---

## ハマった点1: テーブル名衝突(`jobs`はLaravel標準のキュー用テーブル名)

**症状:** 上記の `jobs` テーブルでマイグレーションを実行するとエラーになった。

**原因:** Laravelは最初から非同期処理(キュー)用のデータを一時保存するための `jobs` テーブルを標準のマイグレーションとして持っている。今回作成した「求人管理用のjobsテーブル」と、Laravel標準の「キュー用のjobsテーブル」が名前衝突していた。

**対処:** テーブル名を `job_postings` に変更する。

1. マイグレーションファイルの `Schema::create` の第一引数を変更:

```php
public function up(): void
{
    Schema::create('job_postings', function (Blueprint $table) {
        $table->id();
        $table->string('company_name');
        $table->string('position');
        $table->string('status')->default('未応募');
        $table->date('application_date')->nullable();
        $table->string('url')->nullable();
        $table->string('location')->nullable();
        $table->integer('salary_min')->nullable();
        $table->integer('salary_max')->nullable();
        $table->text('memo')->nullable();
        $table->timestamps();
    });
}

public function down(): void
{
    Schema::dropIfExists('job_postings');
}
```

2. Eloquentは「`Job`モデル → `jobs`テーブル」と自動推測してしまうため、`app/Models/Job.php` でテーブル名を明示的に上書きする。あわせて `$fillable` も設定(これがないと後のDay2でPOST/PUTのデータが保存できずハマるため、この時点で入れておく)。

```php
class Job extends Model
{
    protected $table = 'job_postings';

    protected $fillable = [
        'company_name',
        'position',
        'status',
        'application_date',
        'url',
        'location',
        'salary_min',
        'salary_max',
        'memo',
    ];
}
```

3. マイグレーションを再実行:

```bash
php artisan migrate
```

`Migrating: xxxx_create_jobs_table` → `Migrated:` の成功メッセージが出ればOK。モデルクラス名は `Job` のままでよく(`Job::create()` などの呼び方は変わらない)、テーブル名だけ裏側で `job_postings` に向くようになる。

---

## ハマった点2: tinkerで `Class "Job" not found`

**症状:** `php artisan tinker` の中で `Job::create(...)` を実行すると `Class "Job" not found` エラー。

**原因:** テーブル名とは無関係の、tinker特有の名前空間解決の問題。tinker内では名前空間を省略した `Job` だけでは自動解決してくれないことがある。

**対処:** tinkerの中で先に `use` 文を書く。

```bash
php artisan tinker
```

```php
use App\Models\Job;

Job::create(['company_name' => 'テスト株式会社', 'position' => 'エンジニア']);
Job::all();
```

(`use` を書かず `\App\Models\Job::create(...)` とフルパスで書く方法でも動くが、`use` を先に書く方が短く書けて楽)

---

## 動作確認(tinker)

```php
use App\Models\Job;

Job::create(['company_name' => 'テスト株式会社', 'position' => 'エンジニア']);
Job::all();
```

登録したデータが `Job::all()` の結果に出てくればDay1のバックエンド部分は完了。`exit` でtinkerを抜けられる。

---

## DB Browser for SQLiteの導入(DBの中身を目視確認するツール)

tinkerのレスポンスだけでなく、実際のDBファイルの中身を見たいというニーズから導入した。

- 公式配布元: https://github.com/sqlitebrowser/sqlitebrowser/releases
- 確認した時点の最新版は v3.13.1。リリースアセットには `win64` 版のインストーラー(`.msi`)がARM64版と並んで用意されている(「Windows版は2024年が最新でARMしかない」という懸念があったが、実際にはv3.13.1にwin64版がちゃんと含まれていることをリリースページで確認した)
- `DB.Browser.for.SQLite-v3.13.1-win64.msi` をダウンロードし、ダブルクリックしてインストールウィザードを進めるだけで導入できる(gitコマンドは不要。GitHubのリリースページからファイルを直接ダウンロードするだけ)
- 起動後、「データベースを開く」から `backend/database/database.sqlite` を選択して使用する

---

## トラブルシューティング: tinkerで登録したはずのデータがDB Browserに表示されない

**症状:** `Job::all()` ではデータが返ってくるのに、DB Browser for SQLiteでファイルを開いてもデータが見当たらない。

**考えられる原因(確認した順):**

1. **テーブル名の見間違い** — Laravel標準の空の `jobs` テーブルを見てしまっていて、データが入っている `job_postings` テーブルを見ていない可能性(このケースでは、これが実際の原因だった)
2. **DB Browser側の表示が更新されていない** — SQLiteはファイルベースのDBなので、DB Browserを開いたまま裏でtinkerから書き込んでも自動では反映されない。「データベースを開く」で同じファイルを開き直すか、更新アイコン/F5で再読み込みする必要がある
3. **`.env`の`DB_DATABASE`パスの不一致** — Laravelが書き込んでいるファイルと、DB Browserで開いているファイルが実は別物というケース。`DB_DATABASE`行が存在する場合はパスが一致しているか確認(コメントアウト・未指定なら自動で`database/database.sqlite`を見るため問題なし)
4. **ファイルの更新日時を確認** — `dir database\database.sqlite`(Windows)でファイルの更新日時を見て、`Job::create()`を実行した時刻と近ければ、ファイル自体への書き込みは成功している(=原因は1か2に絞られる)

このケースでは原因1(テーブル名の見間違い)だった。DB Browserのテーブル選択プルダウンで `jobs` ではなく `job_postings` を選択し直すことで解決した。

---

## 次段階(Day2以降)

[docs/day2-work-log.md](day2-work-log.md) 以降を参照。ここで作られた `job_postings` テーブル・`Job` モデルを土台に、Day2でJobController・FormRequestバリデーションを実装している。
