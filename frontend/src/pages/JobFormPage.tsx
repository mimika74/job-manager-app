import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiValidationError, createJob } from '../api/jobs'
import { JOB_STATUSES, type JobStatus } from '../types/job'

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

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null
  return <p className="field-error">{messages[0]}</p>
}

export default function JobFormPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(initialState)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function handleChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setErrors({})
    setSubmitError(null)

    try {
      await createJob({
        company_name: form.company_name,
        position: form.position,
        status: form.status,
        application_date: form.application_date || null,
        url: form.url || null,
        location: form.location || null,
        salary_min: form.salary_min === '' ? null : Number(form.salary_min),
        salary_max: form.salary_max === '' ? null : Number(form.salary_max),
        memo: form.memo || null,
      })
      navigate('/')
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

  return (
    <form className="card job-form" onSubmit={handleSubmit} noValidate>
      <h2>求人を新規登録</h2>
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

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? '登録中...' : '登録する'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => navigate('/')}>
          キャンセル
        </button>
      </div>
    </form>
  )
}
