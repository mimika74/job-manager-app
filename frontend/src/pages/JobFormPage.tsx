import { useNavigate, useParams } from 'react-router-dom'
import JobForm from '../components/JobForm'

export default function JobFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const jobId = id ? Number(id) : null

  return (
    <JobForm
      jobId={jobId}
      onClose={() => navigate('/')}
      onSuccess={() => navigate('/')}
    />
  )
}
