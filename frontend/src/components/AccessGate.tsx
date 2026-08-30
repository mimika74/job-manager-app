import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { verifyAccessKey } from '../api/jobs'
import { getStoredAccessKey, setStoredAccessKey } from '../lib/accessKey'

type Status = 'checking' | 'unlocked' | 'locked'

export default function AccessGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking')
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // バックエンドでACCESS_KEYが未設定(=保護オフ)の場合、空文字でもverifyは成功する。
    // そのためローカル開発時はゲート画面を出さずに素通りできる。
    const stored = getStoredAccessKey() ?? ''
    verifyAccessKey(stored)
      .then(() => setStatus('unlocked'))
      .catch(() => setStatus('locked'))
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await verifyAccessKey(input)
      setStoredAccessKey(input)
      setStatus('unlocked')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'checking') {
    return (
      <div className="access-gate-wrap">
        <div className="card empty-state">
          <p>確認中...</p>
        </div>
      </div>
    )
  }

  if (status === 'locked') {
    return (
      <div className="access-gate-wrap">
        <form className="card access-gate-form" onSubmit={handleSubmit} noValidate>
          <div className="brand-mark">JOB</div>
          <h2>アクセスキーを入力してください</h2>
          <p className="access-gate-desc">このアプリを見るにはアクセスキーが必要です。</p>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="アクセスキー"
            autoFocus
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={submitting || input === ''}>
            {submitting ? '確認中...' : '入る'}
          </button>
        </form>
      </div>
    )
  }

  return <>{children}</>
}
