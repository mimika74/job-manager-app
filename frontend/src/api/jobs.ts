import type { CreateJobInput, Job } from '../types/job'

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api'

interface ApiErrorBody {
  message?: string
  errors?: Record<string, string[]>
}

export class ApiValidationError extends Error {
  errors: Record<string, string[]>

  constructor(message: string, errors: Record<string, string[]>) {
    super(message)
    this.name = 'ApiValidationError'
    this.errors = errors
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body: ApiErrorBody | null = await response.json().catch(() => null)
    if (response.status === 422 && body?.errors) {
      throw new ApiValidationError(body.message ?? 'Validation failed', body.errors)
    }
    throw new Error(body?.message ?? `Request failed with status ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function fetchJobs(): Promise<Job[]> {
  return fetch(`${API_BASE_URL}/jobs`, {
    headers: { Accept: 'application/json' },
  }).then((response) => handleResponse<Job[]>(response))
}

export function createJob(input: CreateJobInput): Promise<Job> {
  return fetch(`${API_BASE_URL}/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  }).then((response) => handleResponse<Job>(response))
}

export function fetchJob(id: number): Promise<Job> {
  return fetch(`${API_BASE_URL}/jobs/${id}`, {
    headers: { Accept: 'application/json' },
  }).then((response) => handleResponse<Job>(response))
}

export function updateJob(id: number, input: CreateJobInput): Promise<Job> {
  return fetch(`${API_BASE_URL}/jobs/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  }).then((response) => handleResponse<Job>(response))
}
