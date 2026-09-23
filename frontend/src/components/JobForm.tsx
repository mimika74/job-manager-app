import { useEffect, useState, type FormEvent } from 'react'
import { ApiValidationError, createJob, deleteJob, fetchJob, updateJob } from '../api/jobs'
import { JOB_STATUSES, type Job, type JobStatus } from '../types/job'

interface FormState {
  company_name: string
  position: string
  status: JobStatus
  application_date: string
  url: string
  location: string
  salary_min: string
  salary_max: string
  memo: string
}

const initialState: FormState = {
  company_name: '',
  position: '',
  status: '未応募',
  application_date: '',
  url: '',
  location: '',
  salary_min: '',
  salary_max: '',
  memo: '',
}

function toFormState(job: Job): FormState {
  return {
    company_name: job.company_name,
    position: job.position,
    status: job.status,
    application_date: job.application_date ?? '',
    url: job.url ?? '',
    location: job.location ?? '',
    salary_min: job.salary_min == null ? '' : String(job.salary_min),
    salary_max: job.salary_max == null ? '' : String(job.salary_max),
    memo: job.memo ?? '',
  }
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null
  return <p className="field-error">{messages[0]}</p>
}

interface JobFormProps {
  jobId: number | null   // nullなら新規登録モード、数値なら編集モード
  onClose: () => void    // キャンセル時に呼ぶ
  onSuccess: () => void  // 保存 or 削除が成功したときに呼ぶ
}

export default function JobForm(props: JobFormProps) {
  const isEditMode = props.jobId !== null
  const jobId = isEditMode ? Number(props.jobId) : null

  const [form, setForm] = useState<FormState>(initialState)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loading, setLoading] = useState(isEditMode)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function loadJob(onCancelled?: () => boolean) {
    if (jobId === null) return
    setLoading(true)
    setLoadError(null)
    fetchJob(jobId)
      .then((job) => {
        if (onCancelled?.()) return
        setForm(toFormState(job))
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (onCancelled?.()) return
        setLoadError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
  }

  useEffect(() => {
    let cancelled = false
    setErrors({})
    setSubmitError(null)
    setDeleteError(null)
    setConfirmingDelete(false)
    loadJob(() => cancelled)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  async function handleDelete() {
    if (jobId === null) return

    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteJob(jobId)
      props.onSuccess()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err))
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  function handleChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setErrors({})
    setSubmitError(null)

    const payload = {
      company_name: form.company_name,
      position: form.position,
      status: form.status,
      application_date: form.application_date || null,
      url: form.url || null,
      location: form.location || null,
      salary_min: form.salary_min === '' ? null : Number(form.salary_min),
      salary_max: form.salary_max === '' ? null : Number(form.salary_max),
      memo: form.memo || null,
    }

    try {
      if (jobId !== null) {
        await updateJob(jobId, payload)
      } else {
        await createJob(payload)
      }
      props.onSuccess()
    } catch (err) {
      if (err instanceof ApiValidationError) {
        setErrors(err.errors)
      } else {
        setSubmitError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="card empty-state">
        <p>読み込み中...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="card empty-state">
        <div className="icon">⚠️</div>
        <h3>求人データの取得に失敗しました</h3>
        <p role="alert">{loadError}</p>
        <button type="button" className="btn-secondary" onClick={() => loadJob()}>
          再読み込み
        </button>
      </div>
    )
  }

  return (
    <form className="card job-form" onSubmit={handleSubmit} noValidate>
      <h2>{isEditMode ? '求人を編集' : '求人を新規登録'}</h2>
      {submitError && (
        <p className="form-error" role="alert">
          {submitError}
        </p>
      )}

      <div className="field">
        <label htmlFor="company_name">会社名 *</label>
        <input
          id="company_name"
          value={form.company_name}
          onChange={(e) => handleChange('company_name', e.target.value)}
        />
        <FieldError messages={errors.company_name} />
      </div>

      <div className="field">
        <label htmlFor="position">職種/ポジション名 *</label>
        <input
          id="position"
          value={form.position}
          onChange={(e) => handleChange('position', e.target.value)}
        />
        <FieldError messages={errors.position} />
      </div>

      <div className="field">
        <label htmlFor="status">ステータス *</label>
        <select
          id="status"
          value={form.status}
          onChange={(e) => handleChange('status', e.target.value as JobStatus)}
        >
          {JOB_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <FieldError messages={errors.status} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="application_date">応募日</label>
          <input
            id="application_date"
            type="date"
            value={form.application_date}
            onChange={(e) => handleChange('application_date', e.target.value)}
          />
          <FieldError messages={errors.application_date} />
        </div>

        <div className="field">
          <label htmlFor="location">勤務地</label>
          <input
            id="location"
            value={form.location}
            onChange={(e) => handleChange('location', e.target.value)}
          />
          <FieldError messages={errors.location} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="url">求人URL</label>
        <input
          id="url"
          type="url"
          placeholder="https://"
          value={form.url}
          onChange={(e) => handleChange('url', e.target.value)}
        />
        <FieldError messages={errors.url} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="salary_min">年収レンジ(下限・万円)</label>
          <input
            id="salary_min"
            type="number"
            min="0"
            value={form.salary_min}
            onChange={(e) => handleChange('salary_min', e.target.value)}
          />
          <FieldError messages={errors.salary_min} />
        </div>

        <div className="field">
          <label htmlFor="salary_max">年収レンジ(上限・万円)</label>
          <input
            id="salary_max"
            type="number"
            min="0"
            value={form.salary_max}
            onChange={(e) => handleChange('salary_max', e.target.value)}
          />
          <FieldError messages={errors.salary_max} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="memo">メモ</label>
        <textarea
          id="memo"
          rows={4}
          value={form.memo}
          onChange={(e) => handleChange('memo', e.target.value)}
        />
        <FieldError messages={errors.memo} />
      </div>

      {deleteError && (
        <p className="form-error" role="alert">
          {deleteError}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? '保存中...' : isEditMode ? '更新する' : '登録する'}
        </button>
        <button type="button" className="btn-secondary" onClick={props.onClose}>
          キャンセル
        </button>
        {isEditMode && !confirmingDelete && (
          <button
            type="button"
            className="btn-secondary btn-danger"
            onClick={() => setConfirmingDelete(true)}
          >
            削除する
          </button>
        )}
      </div>

      {isEditMode && confirmingDelete && (
        <div className="delete-confirm">
          <p>本当にこの求人を削除しますか?この操作は取り消せません。</p>
          <div className="delete-confirm-actions">
            <button
              type="button"
              className="btn-primary btn-danger"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? '削除中...' : 'はい、削除する'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={deleting}
              onClick={() => setConfirmingDelete(false)}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </form>
  )
}
