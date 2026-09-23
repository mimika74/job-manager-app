import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JobListPage from './JobListPage'
import App from '../App'
import type { Job } from '../types/job'

// api/jobs.ts をまるごと偽物に差し替える。
// 実際のfetch通信は一切発生せず、テストの中で戻り値を自由に決められる。
vi.mock('../api/jobs', () => ({
  fetchJobs: vi.fn(),
  fetchJob: vi.fn(),
  createJob: vi.fn(),
  updateJob: vi.fn(),
  updateJobStatus: vi.fn(),
  deleteJob: vi.fn(),
  ApiValidationError: class ApiValidationError extends Error {
    errors: Record<string, string[]>
    constructor(message: string, errors: Record<string, string[]>) {
      super(message)
      this.name = 'ApiValidationError'
      this.errors = errors
    }
  },
}))

import { fetchJobs, fetchJob, createJob, updateJob, updateJobStatus, deleteJob } from '../api/jobs'

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 1,
    company_name: 'サンプル株式会社',
    position: 'エンジニア',
    status: '未応募',
    application_date: null,
    url: null,
    location: null,
    salary_min: null,
    salary_max: null,
    memo: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderJobListPage() {
  return render(
    <MemoryRouter>
      <JobListPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('一覧⇄カンバンのデータ同期', () => {
  it('一覧で追加した求人がカンバンに表示される', async () => {
    const user = userEvent.setup()
    const existingJob = makeJob({ id: 1, company_name: '既存株式会社', status: '未応募' })
    const newJob = makeJob({ id: 2, company_name: '新規株式会社', status: '未応募' })

    // JobListPageはマウント時に一度fetchJobsを呼ぶ → まず既存の1件だけを返す
    vi.mocked(fetchJobs).mockResolvedValueOnce([existingJob])
    // 登録成功後、JobListPageは一覧をもう一度取得し直す(load())。
    // 2回目の呼び出しでは、新しい求人も含めて2件を返すようにしておく。
    vi.mocked(fetchJobs).mockResolvedValueOnce([existingJob, newJob])
    vi.mocked(createJob).mockResolvedValue(newJob)

    renderJobListPage()

    // 初回読み込みは非同期なので、画面に出てくるまで待つ必要がある
    await screen.findByText('既存株式会社')

    // 「+ 新規登録」モーダルを開く
    await user.click(screen.getByRole('button', { name: '+ 新規登録' }))

    await user.type(screen.getByLabelText('会社名 *'), '新規株式会社')
    await user.type(screen.getByLabelText('職種/ポジション名 *'), 'エンジニア')

    await user.click(screen.getByRole('button', { name: '登録する' }))

    // モーダルが閉じ、一覧(この時点ではviewMode='list')に新しい求人が表示されるのを待つ
    await screen.findByText('新規株式会社')

    // カンバン表示に切り替える
    await user.click(screen.getByRole('button', { name: 'カンバン' }))

    // 「未応募」列の中に新しい求人が表示されていることを確認する
    const column = screen.getByText('未応募').closest('.kanban-column') as HTMLElement
    expect(within(column).getByText('新規株式会社')).toBeInTheDocument()
  })

  it('カンバンで状態変更すると一覧にも反映される', async () => {
    const user = userEvent.setup()
    const job = makeJob({ id: 1, company_name: '対象株式会社', status: '未応募' })

    vi.mocked(fetchJobs).mockResolvedValueOnce([job])
    vi.mocked(updateJobStatus).mockResolvedValue({ ...job, status: '内定' })

    renderJobListPage()
    await screen.findByText('対象株式会社')

    await user.click(screen.getByRole('button', { name: 'カンバン' }))

    // jsdomには本物のDataTransferがないので、
    // JobKanbanViewが実際に呼んでいる setData/getData の2つだけを持つ「偽物」を用意する
    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => String(job.id)),
    }

    const card = screen.getByText('対象株式会社').closest('.kanban-card') as HTMLElement
    fireEvent.dragStart(card, { dataTransfer })

    const targetColumn = screen.getByText('内定').closest('.kanban-column') as HTMLElement
    const targetBody = targetColumn.querySelector('.kanban-column-body') as HTMLElement
    fireEvent.dragOver(targetBody, { dataTransfer })
    fireEvent.drop(targetBody, { dataTransfer })

    // updateJobStatusが正しい引数(id=1, 内定)で呼ばれたことを確認
    await vi.waitFor(() => {
      expect(updateJobStatus).toHaveBeenCalledWith(1, '内定')
    })

    // 一覧表示に切り替えて、ステータスが反映されていることを確認する
    await user.click(screen.getByRole('button', { name: '一覧' }))
    expect(await screen.findByText('内定')).toBeInTheDocument()
  })

  it('一覧で編集するとカンバンカードも更新される', async () => {
    const user = userEvent.setup()
    const job = makeJob({ id: 1, company_name: '旧社名株式会社', status: '未応募' })
    const updatedJob = { ...job, company_name: '新社名株式会社' }

    // 一覧の「編集」リンクは今もページ遷移(/jobs/1/edit)なので、
    // JobListPageだけでなくApp全体(ルーティングごと)を描画する必要がある
    vi.mocked(fetchJobs)
      .mockResolvedValueOnce([job]) // 最初に "/" を開いたとき
      .mockResolvedValueOnce([updatedJob]) // 保存後、"/" に戻ってきて再取得したとき
    vi.mocked(fetchJob).mockResolvedValue(job) // 編集ページを開いたときの読み込み
    vi.mocked(updateJob).mockResolvedValue(updatedJob)

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    await screen.findByText('旧社名株式会社')

    await user.click(screen.getByRole('link', { name: '編集' }))

    // 編集ページに切り替わり、既存の会社名がフォームに読み込まれていることを確認
    const companyInput = await screen.findByLabelText('会社名 *')
    expect(companyInput).toHaveValue('旧社名株式会社')

    await user.clear(companyInput)
    await user.type(companyInput, '新社名株式会社')
    await user.click(screen.getByRole('button', { name: '更新する' }))

    // 一覧に戻り、新しい社名が表示される
    await screen.findByText('新社名株式会社')

    // カンバンに切り替えても同じ内容が反映されている
    await user.click(screen.getByRole('button', { name: 'カンバン' }))
    const column = screen.getByText('未応募').closest('.kanban-column') as HTMLElement
    expect(within(column).getByText('新社名株式会社')).toBeInTheDocument()
  })

  it('片方で削除すると、もう片方からも消える', async () => {
    const user = userEvent.setup()
    const job = makeJob({ id: 1, company_name: '削除対象株式会社', status: '未応募' })

    vi.mocked(fetchJobs)
      .mockResolvedValueOnce([job]) // 最初に "/" を開いたとき
      .mockResolvedValueOnce([]) // 削除後、"/" に戻ってきて再取得したとき
    vi.mocked(fetchJob).mockResolvedValue(job)
    vi.mocked(deleteJob).mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    await screen.findByText('削除対象株式会社')
    await user.click(screen.getByRole('link', { name: '編集' }))
    await screen.findByLabelText('会社名 *')

    await user.click(screen.getByRole('button', { name: '削除する' }))
    await user.click(screen.getByRole('button', { name: 'はい、削除する' }))

    // 一覧に戻り、対象が消えていることを確認
    await waitFor(() => {
      expect(screen.queryByText('削除対象株式会社')).not.toBeInTheDocument()
    })

    // カンバンに切り替えても存在しない
    await user.click(screen.getByRole('button', { name: 'カンバン' }))
    expect(screen.queryByText('削除対象株式会社')).not.toBeInTheDocument()
  })

  it('API失敗時に画面だけ変更された状態が残らない', async () => {
    const user = userEvent.setup()
    const job = makeJob({ id: 1, company_name: '対象株式会社', status: '未応募' })

    vi.mocked(fetchJobs).mockResolvedValueOnce([job])
    // updateJobStatusをわざと失敗させる(通信エラーを再現)
    vi.mocked(updateJobStatus).mockRejectedValue(
      new Error('サーバーに接続できませんでした。通信環境を確認するか、しばらくしてから再度お試しください。')
    )

    renderJobListPage()
    await screen.findByText('対象株式会社')
    await user.click(screen.getByRole('button', { name: 'カンバン' }))

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => String(job.id)),
    }
    const card = screen.getByText('対象株式会社').closest('.kanban-card') as HTMLElement
    fireEvent.dragStart(card, { dataTransfer })

    const targetColumn = screen.getByText('内定').closest('.kanban-column') as HTMLElement
    const targetBody = targetColumn.querySelector('.kanban-column-body') as HTMLElement
    fireEvent.dragOver(targetBody, { dataTransfer })
    fireEvent.drop(targetBody, { dataTransfer })

    // 一度は「内定」列に楽観的更新されるが、APIが失敗するので元の「未応募」列に戻る
    await waitFor(() => {
      const originalColumn = screen.getByText('未応募').closest('.kanban-column') as HTMLElement
      expect(within(originalColumn).getByText('対象株式会社')).toBeInTheDocument()
    })

    // 「内定」列には残っていない
    const kanbanColumn = screen.getByText('内定').closest('.kanban-column') as HTMLElement
    expect(within(kanbanColumn).queryByText('対象株式会社')).not.toBeInTheDocument()

    // エラーメッセージがバナーで表示されている
    expect(screen.getByText(/サーバーに接続できませんでした/)).toBeInTheDocument()
  })
})
