import { useCallback, useEffect, useState } from 'react'
import { fetchJobs, updateJobStatus } from '../api/jobs'
import type { Job, JobStatus } from '../types/job'
import JobTableView from '../components/JobTableView'
import JobKanbanView from '../components/JobKanbanView'
import Modal from '../components/Modal'
import JobForm from '../components/JobForm'

type LoadState = 'loading' | 'success' | 'error'

export default function JobListPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [isCreating, setIsCreating] = useState<boolean | null>(false) 

  const load = useCallback(() => {
    setState('loading')
    setError(null)

    fetchJobs()
      .then((data) => {
        setJobs(data)
        setState('success')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
        setState('error')
      })
  }, [])


  const handleStatusChange = (jobId: number, newStatus: JobStatus) => {
    const previousJobs = jobs // ① 今の jobs を退避しておく

    setJobs((prevJobs) =>
      prevJobs.map((job) =>
        job.id === jobId ? { ...job, status: newStatus } : job
      )
    ) // ② 画面を先に更新(楽観的更新)

    updateJobStatus(jobId, newStatus).catch((err: unknown) => {
      setJobs(previousJobs) // ③ 失敗したら退避しておいたjobsに戻す
      setError(err instanceof Error ? err.message : String(err))
    })
  }

  useEffect(() => {
    load()
  }, [load])

  let content
  if (state === 'loading') {
    content = (
      <div className="card empty-state">
        <p>読み込み中...</p>
      </div>
    )
  } else if (state === 'error') {
    content = (
      <div className="card empty-state">
        <div className="icon">⚠️</div>
        <h3>求人データの取得に失敗しました</h3>
        <p role="alert">{error}</p>
        <button type="button" className="btn-secondary" onClick={load}>
          再読み込み
        </button>
      </div>
    )
  } else if (jobs.length === 0) {
    content = (
      <div className="card empty-state">
        <div className="icon">🗂️</div>
        <h3>登録済みの求人はありません</h3>
        <p>新規登録すると、ここに一覧表示されます。</p>
      </div>
    )
  } else {
    content = viewMode === 'list' ? (
      <div className="table-wrap">
        <div className="table-scroll">
          <JobTableView jobs={jobs} />
        </div>
      </div>
    ) : (
      <JobKanbanView jobs={jobs} onStatusChange={handleStatusChange} onJobsChanged={() => load()} />
    )
  }

  return (
    <>
      <div className="list-toolbar">
        <h2>求人一覧</h2>
        <div className="list-toolbar-actions">
          <button 
            type="button"
            className={viewMode === 'list' ? "btn-primary" : "btn-secondary"}
            onClick={() => setViewMode('list')}
          >
            一覧
          </button>
          <button 
            type="button"
            className={viewMode === 'kanban' ? "btn-primary" : "btn-secondary"}
            onClick={() => setViewMode('kanban')}
          >
            カンバン
          </button>
          <button className="btn-primary" onClick={() => setIsCreating(true)}>
            + 新規登録
          </button>
        </div>
      </div>
      {isCreating && (
        <Modal onClose={() => setIsCreating(false)}>
          <JobForm
            jobId={null} // ② 新規登録モードであることを示す値
            onClose={() => setIsCreating(false)}
            onSuccess={() => {
              setIsCreating(false)
              load() // ③ 一覧を再取得
            }}
          />
        </Modal>
      )}
      {state === 'success' && error && (
        <div className="form-error">{error}</div>
      )}
      {content}
    </>
  )
}
