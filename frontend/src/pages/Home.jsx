import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckSquare } from 'lucide-react'
import api, { fmtDate } from '../api'
import { useAuth, useTitle } from '../App'
import Badge, { Empty, SkillChips } from '../components/Badge'

function Profile() {
  const { user } = useAuth()
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display font-bold">Profile & skills</h2>
        <Link to={`/users/${user.id}`} className="link text-sm">View profile</Link>
      </div>
      <p className="mb-3 text-sm text-ink-soft">{user.bio || <span className="text-ink-mute">No bio yet.</span>}</p>
      <SkillChips skills={user.skills || []} />
    </div>
  )
}

export default function Home() {
  const { user } = useAuth()
  useTitle('Home')
  const [tasks, setTasks] = useState(null)
  const [requests, setRequests] = useState([])

  useEffect(() => {
    api.get('/my/tasks').then((r) => setTasks(r.data))
    api.get('/my/requests').then((r) => setRequests(r.data))
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const late = tasks?.filter((t) => t.deadline && t.deadline < today).length || 0
  const summary = tasks === null ? '' : !tasks.length ? 'Nothing on your plate. Enjoy it while it lasts.'
    : `${tasks.length} open task${tasks.length > 1 ? 's' : ''}${late ? `, ${late} past due. Maybe start there.` : `. Next one is due ${fmtDate(tasks[0].deadline)}.`}`
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-8">
        <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h2 className="mt-2 font-display text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">Hi, {user.name.split(' ')[0]}.</h2>
        <p className="mt-2 text-ink-soft">{summary}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="card">
          <div className="flex items-center justify-between border-b-2 border-ink px-5 py-3">
            <h2 className="font-display font-bold">My tasks</h2>
            <span className="text-xs text-ink-mute">sorted by deadline</span>
          </div>
          {tasks === null ? (
            <p className="p-5 text-sm text-ink-mute">Loading…</p>
          ) : tasks.length === 0 ? (
            <div className="p-5">
              <Empty icon={CheckSquare} text="No open tasks. Join a crew or pitch your own project.">
                <div className="flex gap-2">
                  <Link to="/discover" className="btn-ghost">Discover projects</Link>
                  <Link to="/new" className="btn-primary">New project</Link>
                </div>
              </Empty>
            </div>
          ) : (
            <ul className="divide-y divide-ink/15">
              {tasks.map((t) => (
                <li key={t.id}>
                  <Link to={`/projects/${t.project_id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 hover:bg-cream-dark">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.title}</span>
                    <span className="text-xs text-ink-mute">{t.project_title}</span>
                    <Badge value={t.status} />
                    <Badge value={t.priority} />
                    <span className={`w-16 text-right text-xs ${t.deadline && t.deadline < today ? 'font-bold text-tomato-ink' : 'text-ink-mute'}`}>{fmtDate(t.deadline)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="space-y-6">
        <Profile />
        <div className="card p-5">
          <h2 className="mb-3 font-display font-bold">My join requests</h2>
          {requests.length === 0 && <p className="text-sm text-ink-mute">No requests yet.</p>}
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{r.project_title}</span>
                <Badge value={r.status} />
              </li>
            ))}
          </ul>
        </div>
      </div>
      </div>
    </div>
  )
}
