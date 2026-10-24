import { Component, createContext, useContext, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { getUser, onToast } from './api'
import Sidebar from './components/Sidebar'
import NotificationBell from './components/NotificationBell'
import Login from './pages/Login'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import Profile from './pages/Profile'
import Home from './pages/Home'
import Discover from './pages/Discover'
import NewProject from './pages/NewProject'
import Project from './pages/Project'
import FacultyDashboard from './pages/FacultyDashboard'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

// page title shown in the top bar; pages call setTitle
const TitleCtx = createContext(() => {})
export const useTitle = (title) => {
  const set = useContext(TitleCtx)
  useEffect(() => {
    set(title)
  }, [title, set])
}

// shows the error instead of a blank screen if any page crashes while rendering
class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('CrewGrid crashed:', error, info.componentStack)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto max-w-xl p-6">
        <div className="sticker space-y-4 p-6">
          <h2 className="text-xl font-bold">Well, that broke.</h2>
          <p className="text-sm text-ink-soft">Something went wrong on this page. The error is below if you want to tell someone.</p>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border-2 border-ink bg-cream p-3 text-xs">{String(this.state.error?.message || this.state.error)}</pre>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => window.location.reload()}>Reload</button>
            <a className="btn-ghost" href="/">Go home</a>
          </div>
        </div>
      </div>
    )
  }
}

function Toaster() {
  const [items, setItems] = useState([])
  useEffect(
    () =>
      onToast((t) => {
        setItems((xs) => [...xs, t])
        setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 3500)
      }),
    [],
  )
  return (
    <div role="status" aria-live="polite" className="fixed bottom-4 left-1/2 z-50 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className={`rounded-lg border-2 border-ink px-4 py-2.5 text-sm font-semibold text-ink shadow-hard ${t.type === 'error' ? 'bg-tomato' : 'bg-mint'}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

function Layout({ children }) {
  const [title, setTitle] = useState('')
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => {
    setOpen(false)
  }, [loc.pathname])
  return (
    <TitleCtx.Provider value={setTitle}>
      <div className="flex h-screen overflow-hidden">
        <div className={`fixed inset-y-0 left-0 z-40 w-64 transform transition-transform md:static md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar />
        </div>
        {open && <div className="fixed inset-0 z-30 bg-ink/30 md:hidden" onClick={() => setOpen(false)} />}
        <div className="dot-grid flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-3 border-b-2 border-ink bg-cream px-4 md:px-8">
            <button className="rounded-md p-1 md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
            <h1 className="truncate font-display text-xl font-extrabold">{title}</h1>
            <div className="ml-auto"><NotificationBell /></div>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto">
            <ErrorBoundary key={loc.pathname}>{children}</ErrorBoundary>
          </main>
        </div>
      </div>
    </TitleCtx.Provider>
  )
}

function Guard({ children, role }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to="/" replace />
  if (!user.skills?.length) return <Onboarding />
  return <Layout>{children}</Layout>
}

export default function App() {
  const [user, setUserState] = useState(getUser())
  const setUser = (u, token) => {
    if (token) localStorage.setItem('token', token)
    if (u) localStorage.setItem('user', JSON.stringify(u))
    else {
      localStorage.removeItem('user')
      localStorage.removeItem('token')
    }
    setUserState(u)
  }
  return (
    <AuthCtx.Provider value={{ user, setUser }}>
      <ErrorBoundary>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={!user ? <Landing /> : <Guard>{user?.role === 'faculty' ? <FacultyDashboard /> : <Home />}</Guard>} />
        <Route path="/discover" element={<Guard role="student"><Discover /></Guard>} />
        <Route path="/new" element={<Guard role="student"><NewProject /></Guard>} />
        <Route path="/projects/:id" element={<Guard><Project /></Guard>} />
        <Route path="/users/:id" element={<Guard><Profile /></Guard>} />
        <Route path="/faculty" element={<Guard role="faculty"><FacultyDashboard /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ErrorBoundary>
      <Toaster />
    </AuthCtx.Provider>
  )
}
