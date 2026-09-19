<?php

namespace Tests\Feature;

use App\Models\Job;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class JobApiTest extends TestCase
{
    use RefreshDatabase;

    private function createJob(array $overrides = []): Job
    {
        return Job::create(array_merge([
            'company_name' => '株式会社サンプル',
            'position' => 'バックエンドエンジニア',
            'status' => '未応募',
            'salary_min' => 400,
            'salary_max' => 600,
        ], $overrides));
    }

    // ---- index ----

    public function test_index_returns_all_jobs(): void
    {
        $this->createJob(['company_name' => 'A社']);
        $this->createJob(['company_name' => 'B社']);

        $response = $this->getJson('/api/jobs');

        $response->assertOk();
        $response->assertJsonCount(2);
    }

    // ---- store ----

    public function test_store_creates_job_with_valid_data(): void
    {
        $payload = [
            'company_name' => '株式会社テスト',
            'position' => 'エンジニア',
            'status' => '未応募',
            'application_date' => '2026-08-20',
            'url' => 'https://example.com/jobs/1',
            'location' => '東京都',
            'salary_min' => 500,
            'salary_max' => 650,
            'memo' => 'カジュアル面談経由',
        ];

        $response = $this->postJson('/api/jobs', $payload);

        $response->assertCreated();
        $response->assertJsonFragment(['company_name' => '株式会社テスト']);
        $this->assertDatabaseHas('job_postings', ['company_name' => '株式会社テスト']);
    }

    public function test_store_fails_when_required_fields_are_missing(): void
    {
        $response = $this->postJson('/api/jobs', []);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['company_name', 'position', 'status']);
    }

    public function test_store_fails_with_invalid_status(): void
    {
        $response = $this->postJson('/api/jobs', [
            'company_name' => 'テスト株式会社',
            'position' => 'エンジニア',
            'status' => '検討中',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['status']);
    }

    public function test_store_fails_with_invalid_url(): void
    {
        $response = $this->postJson('/api/jobs', [
            'company_name' => 'テスト株式会社',
            'position' => 'エンジニア',
            'status' => '未応募',
            'url' => 'not-a-valid-url',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['url']);
    }

    public function test_store_fails_when_salary_max_is_less_than_salary_min(): void
    {
        $response = $this->postJson('/api/jobs', [
            'company_name' => 'テスト株式会社',
            'position' => 'エンジニア',
            'status' => '未応募',
            'salary_min' => 600,
            'salary_max' => 400,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['salary_max']);
    }

    // ---- show ----

    public function test_show_returns_a_job(): void
    {
        $job = $this->createJob();

        $response = $this->getJson("/api/jobs/{$job->id}");

        $response->assertOk();
        $response->assertJsonFragment(['id' => $job->id]);
    }

    public function test_show_returns_404_for_missing_job(): void
    {
        $response = $this->getJson('/api/jobs/999999');

        $response->assertStatus(404);
    }

    // ---- update ----

    public function test_update_updates_a_job(): void
    {
        $job = $this->createJob(['status' => '未応募']);

        $response = $this->putJson("/api/jobs/{$job->id}", [
            'status' => '内定',
        ]);

        $response->assertOk();
        $response->assertJsonFragment(['status' => '内定']);
        $this->assertDatabaseHas('job_postings', ['id' => $job->id, 'status' => '内定']);
    }

    public function test_update_fails_with_invalid_status(): void
    {
        $job = $this->createJob();

        $response = $this->putJson("/api/jobs/{$job->id}", [
            'status' => '検討中',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['status']);
    }

    public function test_update_fails_when_salary_max_is_less_than_existing_salary_min(): void
    {
        // salary_min=500が既に保存されている状態で、salary_maxだけを部分更新する。
        // 既存のDB値とのクロスフィールド検証が効くことを確認する(Day2で実際にハマった箇所)。
        $job = $this->createJob(['salary_min' => 500, 'salary_max' => 700]);

        $response = $this->putJson("/api/jobs/{$job->id}", [
            'salary_max' => 100,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['salary_max']);
    }

    public function test_update_status_only_does_not_change_other_fields(): void
    {
        // ① 会社名・ステータスを指定して求人を1件作る(createJob()のoverridesを使う)
        $job = $this->createJob([
            'company_name' => '変化しないはずの会社',
            'status' => '未応募',
        ]);

        // ② statusだけをPUTする(company_nameは送らない)
        $response = $this->putJson("/api/jobs/{$job->id}", [
            'status' => '内定' // 何か別のステータスに変える
        ]);

        // ③-a レスポンスが200で、statusが変わっていることを確認
        $response->assertOk();
        $response->assertJsonFragment(['status' => '内定']);

        // ③-b DB上で company_name が元のまま残っていることを確認
        $this->assertDatabaseHas('job_postings', [
            'id' => $job->id,
            'company_name' => '変化しないはずの会社',
        ]);
    }

    public function test_update_returns_404_for_missing_job(): void
    {
        $response = $this->putJson('/api/jobs/999999', ['status' => '内定']);

        $response->assertStatus(404);
    }

    // ---- destroy ----

    public function test_destroy_deletes_a_job(): void
    {
        $job = $this->createJob();

        $response = $this->deleteJson("/api/jobs/{$job->id}");

        $response->assertNoContent();
        $this->assertDatabaseMissing('job_postings', ['id' => $job->id]);
    }

    public function test_destroy_returns_404_for_missing_job(): void
    {
        $response = $this->deleteJson('/api/jobs/999999');

        $response->assertStatus(404);
    }
}
