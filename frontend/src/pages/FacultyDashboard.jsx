import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, PlayCircle, Search, UserPlus, X } from 'lucide-react'
import api, { emit, toast } from '../api'
import { useTitle } from '../App'
import Badge, { Button, HealthBadge, SkillChips } from '../components/Badge'
import { SummaryCard } from '../components/ContributionChart'

function AssignModal({ project, onClose, onDone }) {
  const [students, setStudents] = useState([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(null)
  useEffect(() => { api.get('/faculty/students').then((r) => setStudents(r.data)) }, [])
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const req = new Set(project.required_skills.map((s) => s.toLowerCase()))
  const score = (s) => s.skills.filter((k) => req.has(k.name.toLowerCase())).length
  const list = students
    .filter((s) => `${s.name} ${s.email} ${s.skills.map((k) => k.name).join(' ')}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => score(b) - score(a))

  const assign = async (s) => {
    setBusy(s.id)
    try {
      await api.post('/faculty/assign', { project_id: project.id, user_id: s.id })
      toast(`${s.name} added to ${project.title}`)
      onDone()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="assign-heading" className="sticker flex max-h-[80vh] w-full max-w-lg flex-col shadow-hard-lg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b-2 border-ink px-5 py-3">
          <div>
            <h2 id="assign-heading" className="font-display text-xl font-bold">Assign a student</h2>
            <p className="text-xs text-ink-mute">{project.title} · {project.open_seats} open seat(s)</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-ink-soft hover:bg-cream-dark hover:text-ink"><X size={18} /></button>
        </div>
        <div className="px-5 pt-4"><div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-ink-mute" />
          <input aria-label="Search students or skills" className="input pl-9" placeholder="Search students or skills" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div></div>
        <ul className="min-h-0 flex-1 divide-y divide-ink/15 overflow-y-auto px-2 py-2">
          {list.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-cream-dark">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-sm font-semibold">{s.name} <span className="font-normal text-ink-mute">{s.email}</span></div>
                <SkillChips skills={s.skills} highlight={project.required_skills} />
              </div>
              <Button variant="ghost" loading={busy === s.id} onClick={() => assign(s)}>Add</Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function FacultyDashboard() {
  useTitle('Faculty dashboard')
  const [projects, setProjects] = useState(null)
  const [assignTo, setAssignTo] = useState(null)
  const [checking, setChecking] = useState(false)
  const [expanded, setExpanded] = useState(null)

  const load = () => api.get('/faculty/projects').then((r) => setProjects(r.data))
  useEffect(() => { load() }, [])

  const runChecks = async () => {
    setChecking(true)
    try {
      const r = await api.post('/faculty/run-checks')
      toast(r.data.alerts ? `${r.data.alerts} overdue sprint alert(s) sent` : 'No new overdue sprints')
      load()
    } catch (e) {
      toast.error(e)
    } finally {
      setChecking(false)
    }
  }

  const counts = { green: 0, amber: 0, red: 0 }
  projects?.forEach((p) => counts[p.badge]++)

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
      <div className="flex flex-wrap items-end gap-6">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">Every crew, at a glance.</h2>
          <p className="mt-2 text-ink-soft">See which sprint slipped and who is behind, before the deadline does.</p>
        </div>
        <Button variant="ghost" loading={checking} onClick={runChecks}><PlayCircle size={14} /> Run checks now</Button>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        {[['green', 'bg-mint', 'Healthy'], ['amber', 'bg-mustard', 'Wobbly'], ['red', 'bg-tomato', 'On fire']].map(([b, bg, label]) => (
          <div key={b} className={`rounded-xl border-2 border-ink p-3 ${bg}`}>
            <div className="font-display text-3xl font-extrabold leading-none">{projects ? counts[b] : '–'}</div>
            <div className="mt-1 text-xs font-bold">{label}</div>
          </div>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b-2 border-ink text-left text-[11px] uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-5 py-3 font-bold">Project</th>
              <th className="font-bold">Health</th>
              <th className="font-bold">Progress</th>
              <th className="font-bold">Sprint</th>
              <th className="font-bold">Days left</th>
              <th className="font-bold">Team</th>
              <th className="font-bold">Overdue</th>
              <th className="px-5 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/15">
            {projects?.map((p) => (
              <Fragment key={p.id}>
                <tr className="hover:bg-cream-dark">
                  <td className="px-5 py-3">
                    <Link to={`/projects/${p.id}`} className="font-display text-base font-bold hover:underline hover:decoration-tomato hover:decoration-2 hover:underline-offset-4">{p.title}</Link>
                    <div className="text-xs text-ink-mute">Lead {p.lead_name} · <Badge value={p.status} className="!py-0" /></div>
                  </td>
                  <td><HealthBadge badge={p.badge} health={p.health} /></td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-20 overflow-hidden rounded-full border-[1.5px] border-ink bg-paper"><div className="h-full bg-mint" style={{ width: `${p.progress}%` }} /></div>
                      <span className="text-xs text-ink-soft">{p.progress}%</span>
                    </div>
                  </td>
                  <td className="text-ink-soft">{p.current_sprint ? `S${p.current_sprint.number}` : '—'}</td>
                  <td className="text-ink-soft">{p.current_sprint ? p.current_sprint.days_left : '—'}</td>
                  <td className="text-ink-soft">{p.member_count}/{p.team_size}</td>
                  <td>{p.overdue ? <span className="flex items-center gap-1 text-xs font-bold text-tomato-ink"><AlertTriangle size={13} /> Overdue</span> : <span className="text-xs text-ink-mute">—</span>}</td>
                  <td className="whitespace-nowrap px-5 text-right">
                    {p.summary && (
                      <button className="link mr-3 text-xs" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                        {expanded === p.id ? 'Hide' : 'AI summary'}
                      </button>
                    )}
                    <button className="btn-ghost py-1.5 text-xs" disabled={p.open_seats <= 0} onClick={() => setAssignTo(p)}>
                      <UserPlus size={13} /> Assign student
                    </button>
                  </td>
                </tr>
                {expanded === p.id && (
                  <tr><td colSpan={8} className="px-5 pb-4"><SummaryCard summary={p.summary} /></td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {projects?.length === 0 && <p className="p-6 text-center text-sm text-ink-mute">No projects yet.</p>}
      </div>
      {assignTo && <AssignModal project={assignTo} onClose={() => setAssignTo(null)} onDone={() => { setAssignTo(null); load(); emit('projects') }} />}
    </div>
  )
}
