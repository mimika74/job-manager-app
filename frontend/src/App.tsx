import JobListPage from './pages/JobListPage'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">JOB</div>
          <div className="brand-text">
            <h1>求人管理ノート</h1>
            <p>応募中の求人を一元管理</p>
          </div>
        </div>
      </header>

      <main>
        <JobListPage />
      </main>

      <footer className="appfoot">求人管理Webアプリ MVP</footer>
    </div>
  )
}

export default App
