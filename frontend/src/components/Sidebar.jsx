import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Compass, Home, LayoutDashboard, LogOut, Plus } from 'lucide-react'
import api, { bus } from '../api'
import { useAuth } from '../App'
import { Avatar, DOT, Logo } from './Badge'

const link = ({ isActive }) =>
  `flex items-center gap-2.5 rounded-lg border-2 px-2.5 py-1.5 text-sm font-semibold ${
    isActive ? 'border-ink bg-paper text-ink' : 'border-transparent text-ink-soft hover:bg-cream-dark hover:text-ink'}`

export default function Sidebar() {
  const { user, setUser } = useAuth()
  const [projects, setProjects] = useState([])
  const nav = useNavigate()

  useEffect(() => {
    const load = () => api.get('/my/projects').then((r) => setProjects(r.data)).catch(() => {})
    load()
    bus.addEventListener('projects', load)
    return () => bus.removeEventListener('projects', load)
  }, [])

  return (
    <aside className="flex h-full flex-col border-r-2 border-ink bg-cream">
      <Link to="/" className="flex h-16 shrink-0 items-center gap-2.5 border-b-2 border-ink px-5">
        <Logo size={26} />
        <span className="font-display text-lg font-extrabold tracking-tight">CrewGrid</span>
      </Link>
      <nav aria-label="Main" className="space-y-1 px-3 pt-4">
        {user.role === 'faculty' ? (
          <NavLink to="/" end className={link}><LayoutDashboard size={17} /> Faculty dashboard</NavLink>
        ) : (
          <>
            <NavLink to="/" end className={link}><Home size={17} /> Home</NavLink>
            <NavLink to="/discover" className={link}><Compass size={17} /> Discover</NavLink>
          </>
        )}
      </nav>
      <div className="mt-8 flex items-center justify-between px-5">
        <span className="eyebrow">{user.role === 'faculty' ? 'All projects' : 'My crews'}</span>
        {user.role === 'student' && (
          <button onClick={() => nav('/new')} className="rounded-md border-2 border-ink bg-paper p-0.5 hover:bg-mustard" aria-label="New project" title="New project">
            <Plus size={14} strokeWidth={2.5} />
          </button>
        )}
      </div>
      <nav aria-label="Projects" className="mt-2 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {projects.map((p) => (
          <NavLink key={p.id} to={`/projects/${p.id}`} className={link}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px] border-ink ${DOT[p.badge]}`} aria-label={`health ${p.badge}`} />
            <span className="truncate">{p.title}</span>
          </NavLink>
        ))}
        {!projects.length && <p className="px-2.5 py-1 text-xs text-ink-mute">No crews yet</p>}
      </nav>
      <div className="flex items-center gap-2.5 border-t-2 border-ink p-3">
        <Link to={`/users/${user.id}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 hover:bg-cream-dark" title="Your profile">
          <Avatar name={user.name} color={user.role === 'faculty' ? 'bg-mustard' : 'bg-lilac'} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{user.name}</div>
            <div className="text-xs text-ink-mute">View profile</div>
          </div>
        </Link>
        <button onClick={() => { setUser(null); nav('/') }} className="rounded-md p-1.5 text-ink-soft hover:bg-cream-dark hover:text-ink" aria-label="Log out" title="Log out">
          <LogOut size={17} />
        </button>
      </div>
    </aside>
  )
}
