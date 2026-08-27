import type { JobStatus } from '../types/job'
import { getStatusTone } from '../lib/statusTone'

export default function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={`badge badge-${getStatusTone(status)}`}>{status}</span>
}
