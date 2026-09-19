import type { CreateJobInput, Job, JobStatus } from '../types/job'
import { clearStoredAccessKey, getStoredAccessKey } from '../lib/accessKey'

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
    if (response.status === 404) {
      throw new Error('指定された求人が見つかりませんでした。')
    }
    throw new Error(body?.message ?? `Request failed with status ${response.status}`)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const accessKey = getStoredAccessKey()
  if (accessKey) {
    headers.set('X-Access-Key', accessKey)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  } catch {
    throw new Error('サーバーに接続できませんでした。通信環境を確認するか、しばらくしてから再度お試しください。')
  }

  if (response.status === 401) {
    // アクセスキーが無効/期限切れになったとみなし、保存済みキーを破棄してゲート画面に戻す
    clearStoredAccessKey()
    window.location.reload()
    // reload後は制御が戻らない想定だが、型を満たすために念のため投げる
    throw new Error('アクセスキーの有効期限が切れました。再読み込みします。')
  }

  return handleResponse<T>(response)
}

/** ゲート画面でキー入力直後の検証専用。保存済みキーではなく引数のキーをその場で試す。 */
export async function verifyAccessKey(key: string): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/access-check`, {
      headers: { Accept: 'application/json', 'X-Access-Key': key },
    })
  } catch {
    throw new Error('サーバーに接続できませんでした。通信環境を確認するか、しばらくしてから再度お試しください。')
  }
  if (!response.ok) {
    throw new Error('アクセスキーが正しくないか、有効期限が切れています。')
  }
}

export function fetchJobs(): Promise<Job[]> {
  return apiRequest<Job[]>('/jobs', {
    headers: { Accept: 'application/json' },
  })
}

export function fetchJob(id: number): Promise<Job> {
  return apiRequest<Job>(`/jobs/${id}`, {
    headers: { Accept: 'application/json' },
  })
}

export function createJob(input: CreateJobInput): Promise<Job> {
  return apiRequest<Job>('/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  })
}

export function updateJob(id: number, input: CreateJobInput): Promise<Job> {
  return apiRequest<Job>(`/jobs/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  })
}

export function updateJobStatus(id: number, status: JobStatus): Promise<Job> {
  return apiRequest<Job>(`/jobs/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ status }),
  })
}

export function deleteJob(id: number): Promise<void> {
  return apiRequest<void>(`/jobs/${id}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  })
}
