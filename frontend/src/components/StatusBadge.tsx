import type { JobStatus } from '../types/job'

const STATUS_TONE: Record<JobStatus, string> = {
  未応募: 'neutral',
  応募済: 'info',
  書類選考中: 'gold',
  一次面接: 'gold',
  二次面接: 'gold',
  最終面接: 'accent2',
  内定: 'profit',
  不採用: 'loss',
  辞退: 'neutral',
}

export default function StatusBadge({ status }: { status: JobStatus }) {
  const tone = STATUS_TONE[status] ?? 'neutral'
  return <span className={`badge badge-${tone}`}>{status}</span>
}
