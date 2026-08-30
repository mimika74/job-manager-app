const STORAGE_KEY = 'job_manager_access_key'

export function getStoredAccessKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setStoredAccessKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key)
  } catch {
    // private browsing等でlocalStorageが使えない場合は何もしない
  }
}

export function clearStoredAccessKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
