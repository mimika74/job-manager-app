import { useEffect, useState } from 'react'
import { fetchJobs } from '../api/jobs'
import type { Job } from '../types/job'
import StatusBadge from '../components/StatusBadge'

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

  useEffect(() => {
    let cancelled = false

    fetchJobs()
      .then((data) => {
        if (cancelled) return
        setJobs(data)
        setState('success')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setState('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'loading') {
    return (
      <div className="card empty-state">
        <p>読み込み中...</p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="card empty-state">
        <div className="icon">⚠️</div>
        <h3>求人データの取得に失敗しました</h3>
        <p role="alert">{error}</p>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="card empty-state">
        <div className="icon">🗂️</div>
        <h3>登録済みの求人はありません</h3>
        <p>新規登録すると、ここに一覧表示されます。</p>
      </div>
    )
  }

  return (
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
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="job-row">
                <td>{job.company_name}</td>
                <td>{job.position}</td>
                <td>
                  <StatusBadge status={job.status} />
                </td>
                <td className="mono">{job.application_date ?? '-'}</td>
                <td>{job.location ?? '-'}</td>
                <td className="mono">{formatSalary(job)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
