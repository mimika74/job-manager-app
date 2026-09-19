import { useState } from 'react'
import { JOB_STATUSES, type Job, type JobStatus } from '../types/job'
import { getStatusTone } from '../lib/statusTone'
import { formatSalary } from '../lib/formatSalary'

export default function JobKanbanView({
  jobs,
  onStatusChange,
  }: {
    jobs: Job[]
    onStatusChange: (jobId: number, newStatus: JobStatus) => void
  } ) {
    const [dragOverStatus, setDragOverStatus] = useState<JobStatus | null>(null)

    return (
      <div className="kanban-board">
        {JOB_STATUSES.map((status) => {
          const jobsInStatus = jobs.filter((job) => job.status === status)
          return (
            <div key={status} className={`kanban-column tone-${getStatusTone(status)}`}>
              <div className="kanban-column-header">
                <span>{status}</span>
                <span className="kanban-column-count">{jobsInStatus.length}</span>
              </div>
              <div
                className={`kanban-column-body${dragOverStatus === status ? ' drag-over' : ''}`}
                onDragOver={(event) => event.preventDefault()}
                onDragEnter={() => setDragOverStatus(status)}
                onDragLeave={() => setDragOverStatus(null)}
                onDrop={(event) => {
                  const jobId =Number(event.dataTransfer.getData('text/plain'))
                  onStatusChange(jobId, status)
                  setDragOverStatus(null)
                }}
              >
                {jobsInStatus.length === 0 ? (
                  <p className="kanban-column-empty">なし</p>
                ) : (
                  jobsInStatus.map((job) => (
                    <div 
                      key={job.id}
                      className="kanban-card"
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData('text/plain', String(job.id))}
                      >
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
