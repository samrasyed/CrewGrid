import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { FolderGit2 } from 'lucide-react'
import api, { toast } from '../api'
import { useAuth, useTitle } from '../App'
import Badge, { Avatar, Button, Empty, SkillChips, Spinner } from '../components/Badge'
import SkillEditor from '../components/SkillEditor'
import { Sized } from '../components/ContributionChart'

const INK = '#1A1A1A'
const METRICS = [
  { key: 'contribution', label: 'Contribution', color: 'bg-tomato', help: 'Share of the team’s finished work compared with an equal share. 100 means at least pulling their weight.' },
  { key: 'consistency', label: 'Consistency', color: 'bg-sky', help: 'Share of their sprints in which they finished at least one task.' },
  { key: 'on_time', label: 'On time', color: 'bg-mint', help: 'Tasks finished by the deadline. Overdue open tasks count as late.' },
]

function Meter({ m, value }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-semibold">{m.label}</span>
        <span className="font-display text-lg font-extrabold">{value ?? '—'}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full border-2 border-ink bg-paper" role="meter" aria-label={m.label}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? 0}>
        <div className={`h-full ${m.color}`} style={{ width: `${value ?? 0}%` }} />
      </div>
      <p className="mt-1 text-xs text-ink-mute">{m.help}</p>
    </div>
  )
}

function EditProfile({ profile, onSaved, onCancel }) {
  const { setUser } = useAuth()
  const [bio, setBio] = useState(profile.bio || '')
  const [skills, setSkills] = useState(profile.skills || [])
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!skills.length) return toast.error('Keep at least one skill')
    setSaving(true)
    try {
      const r = await api.put('/me', { bio, skills })
      setUser(r.data)
      toast('Profile saved')
      onSaved()
    } catch (e) {
      toast.error(e)
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="space-y-4">
      <div><label className="label" htmlFor="pf-bio">Bio</label>
        <textarea id="pf-bio" className="input" rows={2} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} /></div>
      <div><label className="label" htmlFor="pf-skill-name">Skills</label><SkillEditor value={skills} onChange={setSkills} idPrefix="pf-skill" /></div>
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <Button loading={saving} onClick={save}>Save profile</Button>
      </div>
    </div>
  )
}

export default function Profile() {
  const { id } = useParams()
  const [p, setP] = useState(null)
  const [editing, setEditing] = useState(false)
  useTitle(p ? (p.is_me ? 'Your profile' : p.name) : 'Profile')

  const load = () => api.get(`/users/${id}`).then((r) => setP(r.data)).catch(toast.error)
  useEffect(() => {
    setP(null)
    setEditing(false)
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return <div className="grid h-full place-items-center text-ink-mute"><Spinner size={22} /></div>

  const isStudent = p.role === 'student'
  const current = p.projects.filter((x) => x.current)
  const past = p.projects.filter((x) => !x.current)
  const hasActivity = p.weekly.some((w) => w.points > 0)

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar name={p.name} className="h-20 w-20 rounded-2xl text-2xl" color={isStudent ? 'bg-lilac' : 'bg-mustard'} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">{p.name}</h2>
            <Badge value={p.role} />
          </div>
          <p className="mt-1 text-sm text-ink-mute">{p.email}</p>
          {!editing && <p className="mt-3 max-w-[62ch] text-ink-soft">{p.bio || <span className="text-ink-mute">No bio yet.</span>}</p>}
        </div>
        {p.is_me && !editing && <button className="btn-ghost self-start" onClick={() => setEditing(true)}>Edit profile</button>}
      </header>

      <section aria-labelledby="skills-h" className="card p-5">
        <h3 id="skills-h" className="mb-3 font-display text-lg font-bold">{isStudent ? 'Skills' : 'Expertise'}</h3>
        {editing ? (
          <EditProfile profile={p} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); load() }} />
        ) : p.skills.length ? (
          <SkillChips skills={p.skills} />
        ) : <p className="text-sm text-ink-mute">No skills listed yet.</p>}
      </section>

      {isStudent && (
        <>
          <section aria-labelledby="perf-h" className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <div className="card space-y-5 p-5">
              <div className="flex items-end justify-between gap-4">
                <h3 id="perf-h" className="font-display text-lg font-bold">Performance</h3>
                <div className="text-right">
                  <div className="font-display text-5xl font-extrabold leading-none">{p.metrics.overall ?? '—'}</div>
                  <div className="eyebrow mt-1">overall</div>
                </div>
              </div>
              {METRICS.map((m) => <Meter key={m.key} m={m} value={p.metrics[m.key]} />)}
              {p.metrics.overall == null && <p className="text-sm text-ink-soft">Not enough finished work to score yet.</p>}
            </div>
            <div className="card p-5">
              <h3 className="font-display text-lg font-bold">Points finished per week</h3>
              <p className="mb-3 text-xs text-ink-mute">Last 12 weeks · {p.totals.points_done} points across {p.totals.tasks_done} tasks in total</p>
              {hasActivity ? (
                <Sized height={240}>{(w) => (
                  <BarChart width={w} height={240} data={p.weekly} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(26,26,26,0.1)" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#4A453E' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: '#4A453E' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip formatter={(v) => [`${v} pts`, 'Finished']} cursor={{ fill: 'rgba(26,26,26,0.06)' }}
                      contentStyle={{ borderRadius: 8, border: `2px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, fontSize: 12 }} />
                    <Bar dataKey="points" fill="#FF5C39" stroke={INK} strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}
                      label={{ position: 'top', fontSize: 11, fontWeight: 600, fill: INK, formatter: (v) => v || '' }} />
                  </BarChart>
                )}</Sized>
              ) : (
                <div className="grid h-[240px] place-items-center text-sm text-ink-mute">No finished tasks in the last 12 weeks.</div>
              )}
            </div>
          </section>

          <section aria-labelledby="proj-h">
            <h3 id="proj-h" className="mb-4 font-display text-xl font-bold">Projects</h3>
            {p.projects.length === 0 ? (
              <Empty icon={FolderGit2} text="No projects yet." />
            ) : (
              <div className="space-y-6">
                {[['Current', current], ['Previously contributed to', past]].filter(([, list]) => list.length).map(([label, list]) => (
                  <div key={label}>
                    <p className="eyebrow mb-2">{label}</p>
                    <ul className="card divide-y divide-ink/15">
                      {list.map((x) => (
                        <li key={x.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                          <div className="min-w-0 flex-1">
                            {x.current ? <Link to={`/projects/${x.id}`} className="font-display font-bold hover:underline hover:decoration-tomato hover:decoration-2 hover:underline-offset-4">{x.title}</Link>
                              : <span className="font-display font-bold">{x.title}</span>}
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-mute">
                              <Badge value={x.role === 'former' ? undefined : x.role} color={x.role === 'former' ? 'zinc' : undefined}>{x.role === 'former' ? 'Former member' : undefined}</Badge>
                              <Badge value={x.status} />
                            </div>
                          </div>
                          <div className="text-sm"><b>{x.points_done}</b> pts · {x.tasks_done} task{x.tasks_done === 1 ? '' : 's'}</div>
                          <div className="flex w-36 items-center gap-2" title="Share of the team's finished work">
                            <div className="h-2.5 flex-1 overflow-hidden rounded-full border-[1.5px] border-ink bg-paper">
                              <div className="h-full bg-lilac" style={{ width: `${x.share}%` }} />
                            </div>
                            <span className="w-9 text-right text-xs font-bold">{x.share}%</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      {!isStudent && <p className="text-ink-soft">Faculty can see every crew from the faculty dashboard.</p>}
    </div>
  )
}
