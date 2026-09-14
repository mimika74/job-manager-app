import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJobs } from '../api/jobs'
import { JOB_STATUSES, type Job } from '../types/job'
import { getStatusTone } from '../lib/statusTone'
import { formatSalary } from '../lib/formatSalary'

type LoadState = 'loading' | 'success' | 'error'

export default function KanbanPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

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
        <p>新規登録すると、ここにカンバン表示されます。</p>
      </div>
    )
  } else {
    content = (
      <div className="kanban-board">
        {JOB_STATUSES.map((status) => {
          const jobsInStatus = jobs.filter((job) => job.status === status)
          return (
            <div key={status} className={`kanban-column tone-${getStatusTone(status)}`}>
              <div className="kanban-column-header">
                <span>{status}</span>
                <span className="kanban-column-count">{jobsInStatus.length}</span>
              </div>
              <div className="kanban-column-body">
                {jobsInStatus.length === 0 ? (
                  <p className="kanban-column-empty">なし</p>
                ) : (
                  jobsInStatus.map((job) => (
                    <div key={job.id} className="kanban-card">
                      <p className="kanban-card-company">{job.company_name}</p>
                      <p className="kanban-card-position">{job.position}</p>
                      <div className="kanban-card-meta">
                        <span>{job.application_date ?? '応募日未定'}</span>
                        <span className="mono">{formatSalary(job)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <div className="list-toolbar">
        <h2>求人カンバン</h2>
        <div className="list-toolbar-actions">
          <Link to="/" className="btn-secondary">
            一覧表示
          </Link>
          <Link to="/jobs/new" className="btn-primary">
            + 新規登録
          </Link>
        </div>
      </div>
      {content}
    </>
  )
}
