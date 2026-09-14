import { Link, Route, Routes } from 'react-router-dom'
import JobListPage from './pages/JobListPage'
import JobFormPage from './pages/JobFormPage'
import KanbanPage from './pages/KanbanPage'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          <div className="brand-mark">JOB</div>
          <div className="brand-text">
            <h1>求人管理ノート</h1>
            <p>応募中の求人を一元管理</p>
          </div>
        </Link>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<JobListPage />} />
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="/jobs/new" element={<JobFormPage />} />
          <Route path="/jobs/:id/edit" element={<JobFormPage />} />
        </Routes>
      </main>

      <footer className="appfoot">求人管理Webアプリ MVP</footer>
    </div>
  )
}

export default App
