import type { Job } from '../types/job'

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api'

interface ApiErrorBody {
  message?: string
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body: ApiErrorBody | null = await response.json().catch(() => null)
    throw new Error(body?.message ?? `Request failed with status ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function fetchJobs(): Promise<Job[]> {
  return fetch(`${API_BASE_URL}/jobs`, {
    headers: { Accept: 'application/json' },
  }).then((response) => handleResponse<Job[]>(response))
}
