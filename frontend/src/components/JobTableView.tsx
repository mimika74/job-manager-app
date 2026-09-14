import { Link } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import { getStatusTone } from '../lib/statusTone'
import { formatSalary } from '../lib/formatSalary'
import type { Job } from '../types/job'


export default function JobTableView({ jobs }: { jobs: Job[]} ) {
    return (
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
    )
}
