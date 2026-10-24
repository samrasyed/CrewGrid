import { useState } from 'react'
import { Pencil, Plus, Scale, Sparkles, Trash2 } from 'lucide-react'
import api, { fmtDate, toast } from '../api'
import Badge, { Button, OfflineBanner } from './Badge'

const MIN_DAYS = 3
const MAX_DAYS = 30
const day = (iso) => new Date(iso + 'T00:00:00')
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// mirrors logic.sprint_ranges on the backend so the lead sees dates before accepting
function sprintRanges(start, end, days) {
  const s0 = day(start)
  const e0 = day(end)
  const n = Math.max(1, Math.ceil((e0 - s0) / 864e5 / days))
  return Array.from({ length: n }, (_, i) => {
    const s = new Date(s0.getTime() + i * days * 864e5)
    const e = i < n - 1 ? new Date(Math.min(s.getTime() + (days - 1) * 864e5, e0.getTime())) : e0
    return { start: iso(s), end: iso(e) }
  })
}

const blankTask = (sprint) => ({ title: 'New task', description: '', phase: sprint, priority: 'medium', points: 3, skills: [], sprint })

export default function PlanReview({ project, tasks, canEdit, onAccepted }) {
  const [days, setDays] = useState(project.sprint_days)
  const [draft, setDraft] = useState(null) // { sprints: [{name, goal}], tasks: [...], offline, replan }
  const [loading, setLoading] = useState('')

  const validDays = days >= MIN_DAYS && days <= MAX_DAYS
  const ranges = sprintRanges(project.start_date, project.end_date, validDays ? days : project.sprint_days)
  const n = ranges.length

  const changeDays = (v) => {
    const d = Number(v)
    setDays(d)
    if (!draft || d < MIN_DAYS || d > MAX_DAYS) return
    const count = sprintRanges(project.start_date, project.end_date, d).length
    setDraft((dr) => ({
      ...dr,
      sprints: Array.from({ length: count }, (_, i) => dr.sprints[i] || { name: `Sprint ${i + 1}`, goal: '' }),
      tasks: dr.tasks.map((t) => ({ ...t, sprint: Math.min(t.sprint, count) })),
    }))
  }

  const run = async (key, fn) => {
    setLoading(key)
    try {
      await fn()
    } catch (e) {
      toast.error(e)
    } finally {
      setLoading('')
    }
  }

  const generate = () => run('generate', async () => {
    const r = await api.post(`/projects/${project.id}/plan`, { sprint_days: days })
    setDays(r.data.sprint_days)
    setDraft({ sprints: r.data.sprints, tasks: r.data.tasks, offline: r.data.offline, replan: false })
  })

  const editCurrent = () => {
    const number = Object.fromEntries(project.sprints.map((s) => [s.id, s.number]))
    setDays(project.sprint_days)
    setDraft({
      sprints: project.sprints.map((s) => ({ name: s.name || '', goal: s.goal || '' })),
      tasks: tasks.map((t) => ({ id: t.id, title: t.title, description: t.description, phase: t.phase, priority: t.priority,
        points: t.points, skills: [], sprint: number[t.sprint_id] || 1, assignee_id: t.assignee_id, status: t.status })),
      offline: false, replan: true,
    })
  }

  const balance = () => run('balance', async () => {
    const r = await api.post(`/projects/${project.id}/plan/balance`, { tasks: draft.tasks, sprint_days: days })
    setDraft((dr) => ({ ...dr, tasks: r.data.tasks }))
    toast('Points spread evenly across sprints')
  })

  const accept = () => run('accept', async () => {
    const r = await api.post(`/projects/${project.id}/plan/accept`, { tasks: draft.tasks, sprints: draft.sprints, sprint_days: days })
    toast(`Plan saved — ${r.data.sprints} sprints of ${days} days`)
    setDraft(null)
    onAccepted()
  })

  const editTask = (i, k, v) => setDraft((dr) => ({ ...dr, tasks: dr.tasks.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }))
  const editSprint = (i, k, v) => setDraft((dr) => ({ ...dr, sprints: dr.sprints.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }))
  const total = draft?.tasks.reduce((a, t) => a + Number(t.points), 0) || 0

  const LengthControl = (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor="sprint-days" className="font-semibold">Sprint length</label>
      <input id="sprint-days" type="number" min={MIN_DAYS} max={MAX_DAYS} value={days} onChange={(e) => changeDays(e.target.value)}
        className={`input w-20 py-1.5 ${validDays ? '' : 'border-tomato-ink'}`} aria-describedby="sprint-days-hint" />
      <span id="sprint-days-hint" className="text-ink-soft">
        {validDays ? <>days → <b className="text-ink">{n} sprint{n > 1 ? 's' : ''}</b> between {fmtDate(project.start_date)} and {fmtDate(project.end_date)}</>
          : `Pick ${MIN_DAYS}–${MAX_DAYS} days`}
      </span>
    </div>
  )

  // ---------- no draft: start screen + overview ----------
  if (!draft) {
    const names = Object.fromEntries(project.members.map((m) => [m.id, m.name]))
    const overview = project.sprints.map((s) => {
      const ts = tasks.filter((t) => t.sprint_id === s.id)
      const per = {}
      ts.forEach((t) => { const k = names[t.assignee_id] || 'Unassigned'; per[k] = (per[k] || 0) + t.points })
      return { ...s, points: ts.reduce((a, t) => a + t.points, 0), count: ts.length, per }
    })
    const maxPts = Math.max(1, ...overview.map((s) => s.points))
    return (
      <div className="space-y-6">
        {canEdit && (
          <div className="card space-y-5 p-6">
            <div>
              <h3 className="font-display text-xl font-bold">Let the AI do the boring part.</h3>
              <p className="mt-1 max-w-[62ch] text-sm text-ink-soft">
                CrewGrid AI reads the project description and drafts named sprints with goals and 10–25 tasks.
                You choose the sprint length, rename sprints, move tasks around, then accept. Owners are balanced automatically.
              </p>
            </div>
            {LengthControl}
            <div className="flex flex-wrap gap-2">
              <Button loading={loading === 'generate'} disabled={!validDays} onClick={generate}><Sparkles size={14} /> Generate plan with AI</Button>
              {tasks.length > 0 && (
                <button className="btn-ghost" onClick={editCurrent}><Pencil size={14} /> Edit current plan</button>
              )}
            </div>
            {tasks.length > 0 && <p className="text-xs text-ink-mute">Generating a new plan replaces the current tasks when you accept it. Editing the current plan keeps progress.</p>}
          </div>
        )}

        <div className="card">
          <div className="flex flex-wrap items-baseline gap-2 border-b-2 border-ink px-5 py-3">
            <span className="font-display font-bold">Sprints</span>
            <span className="text-xs text-ink-soft">{project.sprint_days}-day sprints · points per sprint and who owns them</span>
          </div>
          {overview.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-soft">No sprints yet. They appear when a plan is accepted.</p>
          ) : (
            <ul className="divide-y divide-ink/15">
              {overview.map((s) => (
                <li key={s.id} className="grid gap-2 px-5 py-3 text-sm md:grid-cols-[13rem_1fr_auto] md:items-center">
                  <div>
                    <div className="font-display font-bold">Sprint {s.number}{s.name && <span className="font-normal"> · {s.name}</span>}</div>
                    <div className="text-xs text-ink-soft">{fmtDate(s.start)} – {fmtDate(s.end)}</div>
                  </div>
                  <div className="min-w-0">
                    {s.goal && <p className="mb-1.5 text-ink-soft">{s.goal}</p>}
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {Object.entries(s.per).map(([nm, p]) => <span key={nm} className="rounded-md border-[1.5px] border-ink/25 px-1.5 py-0.5">{nm.split(' ')[0]} {p}</span>)}
                    </div>
                  </div>
                  <span className="flex w-40 items-center gap-2" title={`${s.points} points`}>
                    <span className="h-3 flex-1 overflow-hidden rounded-full border-[1.5px] border-ink bg-paper">
                      <span className="block h-full bg-mustard" style={{ width: `${(100 * s.points) / maxPts}%` }} />
                    </span>
                    <b className="w-10 text-right text-xs">{s.points} pt</b>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  // ---------- draft editor ----------
  return (
    <div className="space-y-5">
      <div className="sticker space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-display text-xl font-bold">{draft.replan ? 'Edit plan' : 'Review the AI draft'}</h3>
          <span className="text-xs text-ink-soft">{draft.tasks.length} tasks · {total} points · ~{Math.round(total / n)} pts per sprint</span>
          {draft.offline && <OfflineBanner />}
        </div>
        {LengthControl}
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" loading={loading === 'balance'} disabled={!validDays || !draft.tasks.length} onClick={balance}>
            <Scale size={14} /> Balance points evenly
          </Button>
          <div className="ml-auto flex gap-2">
            <button className="btn-ghost" onClick={() => setDraft(null)}>Discard</button>
            <Button loading={loading === 'accept'} disabled={!validDays || !draft.tasks.length} onClick={accept}>Accept plan</Button>
          </div>
        </div>
        {draft.replan && <p className="text-xs text-ink-mute">Finished tasks keep their owner. Open tasks keep theirs too; new or unassigned ones get balanced across the crew.</p>}
      </div>

      {ranges.map((r, si) => {
        const sp = draft.sprints[si] || { name: '', goal: '' }
        const items = draft.tasks.map((t, i) => ({ t, i })).filter(({ t }) => t.sprint === si + 1)
        const pts = items.reduce((a, { t }) => a + Number(t.points), 0)
        return (
          <section key={si} className="card" aria-label={`Sprint ${si + 1}`}>
            <div className="grid gap-3 border-b-2 border-ink px-5 py-4 md:grid-cols-[auto_1fr_2fr_auto] md:items-center">
              <div>
                <div className="font-display font-bold">Sprint {si + 1}</div>
                <div className="text-xs text-ink-soft">{fmtDate(r.start)} – {fmtDate(r.end)}</div>
              </div>
              <input aria-label={`Sprint ${si + 1} name`} className="input py-1.5" placeholder="Name, e.g. Foundations" maxLength={40}
                value={sp.name} onChange={(e) => editSprint(si, 'name', e.target.value)} />
              <input aria-label={`Sprint ${si + 1} goal`} className="input py-1.5" placeholder="Goal for this sprint" maxLength={200}
                value={sp.goal} onChange={(e) => editSprint(si, 'goal', e.target.value)} />
              <span className="justify-self-start rounded-full border-2 border-ink bg-mustard px-2.5 py-0.5 text-xs font-bold md:justify-self-end">{pts} pts</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <tbody className="divide-y divide-ink/10">
                  {items.map(({ t, i }) => (
                    <tr key={t.id ?? `new-${i}`}>
                      <td className="py-1.5 pl-5 pr-2">
                        <div className="flex items-center gap-2">
                          {t.status === 'done' && <Badge value="done" />}
                          <input aria-label="Task title" className="input py-1.5" value={t.title} onChange={(e) => editTask(i, 'title', e.target.value)} />
                        </div>
                      </td>
                      <td className="w-28 px-1">
                        <select aria-label="Priority" className="input py-1.5" value={t.priority} onChange={(e) => editTask(i, 'priority', e.target.value)}>
                          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                        </select>
                      </td>
                      <td className="w-20 px-1">
                        <select aria-label="Points" className="input py-1.5" value={t.points} onChange={(e) => editTask(i, 'points', Number(e.target.value))}>
                          {[1, 2, 3, 5, 8].map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td className="w-32 px-1">
                        <select aria-label="Move to sprint" className="input py-1.5" value={t.sprint} onChange={(e) => editTask(i, 'sprint', Number(e.target.value))}>
                          {ranges.map((_, k) => <option key={k} value={k + 1}>Sprint {k + 1}</option>)}
                        </select>
                      </td>
                      <td className="w-12 pr-4 text-right">
                        <button className="rounded-md p-1.5 text-ink-soft hover:bg-tomato/20 hover:text-ink" aria-label={`Delete ${t.title}`}
                          onClick={() => setDraft((dr) => ({ ...dr, tasks: dr.tasks.filter((_, j) => j !== i) }))}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-2.5">
              {!items.length && <p className="mb-2 text-xs text-ink-mute">Empty sprint. Add a task or move one here.</p>}
              <button className="text-sm font-semibold hover:underline hover:underline-offset-4"
                onClick={() => setDraft((dr) => ({ ...dr, tasks: [...dr.tasks, blankTask(si + 1)] }))}>
                <Plus size={14} className="mr-1 inline" />Add task to sprint {si + 1}
              </button>
            </div>
          </section>
        )
      })}
    </div>
  )
}
