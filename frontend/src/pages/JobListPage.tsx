import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJobs } from '../api/jobs'
import type { Job } from '../types/job'
import StatusBadge from '../components/StatusBadge'
import { getStatusTone } from '../lib/statusTone'

type LoadState = 'loading' | 'success' | 'error'

function formatSalary(job: Job): string {
  if (job.salary_min == null && job.salary_max == null) return '-'
  if (job.salary_min != null && job.salary_max != null) {
    return `${job.salary_min}〜${job.salary_max}万円`
  }
  return `${job.salary_min ?? job.salary_max}万円`
}

export default function JobListPage() {
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
        <p>新規登録すると、ここに一覧表示されます。</p>
      </div>
    )
  } else {
    content = (
      <div className="table-wrap">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>会社名</th>
                <th>職種</th>
                <th>ステータス</th>
                <th>応募日</th>
                <th>勤務地</th>
                <th>給与</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className={`job-row tone-${getStatusTone(job.status)}`}>
                  <td>{job.company_name}</td>
                  <td>{job.position}</td>
                  <td>
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="mono">{job.application_date ?? '-'}</td>
                  <td>{job.location ?? '-'}</td>
                  <td className="mono">{formatSalary(job)}</td>
                  <td>
                    <Link to={`/jobs/${job.id}/edit`} className="link-edit">
                      編集
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="list-toolbar">
        <h2>求人一覧</h2>
        <Link to="/jobs/new" className="btn-primary">
          + 新規登録
        </Link>
      </div>
      {content}
    </>
  )
}
