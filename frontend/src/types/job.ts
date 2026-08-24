export const JOB_STATUSES = [
  '未応募',
  '応募済',
  '書類選考中',
  '一次面接',
  '二次面接',
  '最終面接',
  '内定',
  '不採用',
  '辞退',
] as const

export type JobStatus = (typeof JOB_STATUSES)[number]

export interface Job {
  id: number
  company_name: string
  position: string
  status: JobStatus
  application_date: string | null
  url: string | null
  location: string | null
  salary_min: number | null
  salary_max: number | null
  memo: string | null
  created_at: string
  updated_at: string
}

export type CreateJobInput = Omit<Job, 'id' | 'created_at' | 'updated_at'>
