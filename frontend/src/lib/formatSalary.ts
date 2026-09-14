import type { Job } from '../types/job'

export function formatSalary(job: Job): string {
  if (job.salary_min == null && job.salary_max == null) return '-'
  if (job.salary_min != null && job.salary_max != null) {
    return `${job.salary_min}〜${job.salary_max}万円`
  }
  return `${job.salary_min ?? job.salary_max}万円`
}
