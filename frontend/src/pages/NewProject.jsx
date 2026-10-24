import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import api, { emit, toast } from '../api'
import { useTitle } from '../App'
import { Button } from '../components/Badge'

const iso = (d) => d.toISOString().slice(0, 10)

export default function NewProject() {
  useTitle('New project')
  const nav = useNavigate()
  const today = new Date()
  const [form, setForm] = useState({
    title: '', description: '', team_size: 5, sprint_days: 14,
    start_date: iso(today), end_date: iso(new Date(today.getTime() + 56 * 864e5)),
  })
  const [skills, setSkills] = useState([])
  const [skill, setSkill] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const addSkill = (e) => {
    if (e.key !== 'Enter' && e.key !== ',') return
    e.preventDefault()
    const s = skill.trim()
    if (s && !skills.includes(s)) setSkills([...skills, s])
    setSkill('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const extra = skill.trim() && !skills.includes(skill.trim()) ? [skill.trim()] : []
      const r = await api.post('/projects', { ...form, team_size: Number(form.team_size), sprint_days: Number(form.sprint_days), required_skills: [...skills, ...extra] })
      toast('Project created — you are the lead')
      emit('projects')
      nav(`/projects/${r.data.id}`)
    } catch (err) {
      toast.error(err)
    } finally {
      setLoading(false)
    }
  }

  const weeks = Math.max(0, (new Date(form.end_date) - new Date(form.start_date)) / 864e5)
  const sprints = Math.max(1, Math.ceil(weeks / Math.max(1, Number(form.sprint_days) || 1)))

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <div className="mb-8">
        <h2 className="font-display text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">Pitch it.</h2>
        <p className="mt-2 text-ink-soft">Post the project and the skills it needs. You'll be the lead.</p>
      </div>
      <form onSubmit={submit} className="sticker space-y-5 p-6 sm:p-7">
        <div><label className="label" htmlFor="np-title">Title</label><input id="np-title" className="input" required value={form.title} onChange={set('title')} placeholder="e.g. Campus Food Finder" /></div>
        <div><label className="label" htmlFor="np-description">Description</label><textarea id="np-description" className="input" rows={4} value={form.description} onChange={set('description')} placeholder="What will the team build?" /></div>
        <div>
          <label className="label" htmlFor="np-required-skills">Required skills (press Enter to add)</label>
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border-2 border-ink bg-paper px-2 py-1.5 focus-within:shadow-hard-sm">
            {skills.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 rounded-md border-[1.5px] border-ink bg-mustard px-2 py-0.5 text-xs font-semibold text-ink">
                {s}<button type="button" aria-label={`Remove ${s}`} onClick={() => setSkills(skills.filter((x) => x !== s))}><X size={12} /></button>
              </span>
            ))}
            <input id="np-required-skills" className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-ink-mute" value={skill} onChange={(e) => setSkill(e.target.value)} onKeyDown={addSkill} placeholder="React, Python…" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div><label className="label" htmlFor="np-team-size">Team size</label><input id="np-team-size" className="input" type="number" min={1} max={20} value={form.team_size} onChange={set('team_size')} /></div>
          <div>
            <label className="label" htmlFor="np-sprint-length">Sprint length</label>
            <div className="flex items-center gap-2"><input id="np-sprint-length" className="input" type="number" min={3} max={30} required value={form.sprint_days} onChange={set('sprint_days')} /><span className="text-sm text-ink-soft">days</span></div>
          </div>
          <div><label className="label" htmlFor="np-start-date">Start date</label><input id="np-start-date" className="input" type="date" required value={form.start_date} onChange={set('start_date')} /></div>
          <div><label className="label" htmlFor="np-end-date">End date</label><input id="np-end-date" className="input" type="date" required value={form.end_date} onChange={set('end_date')} /></div>
        </div>
        <p className="rounded-lg bg-cream px-3 py-2 text-sm text-ink-soft">That's <b className="text-ink">{sprints} sprint{sprints > 1 ? 's' : ''}</b>. AI will split the work evenly across them once you accept a plan.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => nav(-1)}>Cancel</button>
          <Button loading={loading}>Create crew</Button>
        </div>
      </form>
    </div>
  )
}
