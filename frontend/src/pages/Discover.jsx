import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Compass, Search } from 'lucide-react'
import api, { fmtDate, toast } from '../api'
import { useAuth, useTitle } from '../App'
import Badge, { Button, Empty, SkillChips } from '../components/Badge'

function ProjectCard({ p, mySkills, onRequested }) {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const send = async () => {
    setLoading(true)
    try {
      await api.post(`/projects/${p.id}/requests`, { message: msg })
      toast('Request sent to the team lead')
      setOpen(false)
      onRequested()
    } catch (e) {
      toast.error(e)
    } finally {
      setLoading(false)
    }
  }
  const matchColor = p.match >= 70 ? 'bg-mint' : p.match >= 40 ? 'bg-mustard' : 'bg-cream-dark'
  return (
    <div className="card flex flex-col p-5 transition-transform hover:-translate-y-0.5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold leading-tight">{p.title}</h3>
          <p className="mt-0.5 text-xs text-ink-mute">Lead {p.lead_name} · {fmtDate(p.start_date)} – {fmtDate(p.end_date)}</p>
        </div>
        <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl border-2 border-ink ${matchColor}`} title="Share of required skills you have">
          <span className="font-display text-lg font-extrabold leading-none">{p.match}<span className="text-xs">%</span></span>
        </div>
      </div>
      <p className="mb-4 line-clamp-2 text-sm text-ink-soft">{p.description}</p>
      <SkillChips skills={p.required_skills} highlight={mySkills} />
      <div className="mt-5 flex items-center gap-2 text-xs text-ink-soft" aria-label={`${p.member_count} of ${p.team_size} seats taken`}>
        <span className="flex gap-1" aria-hidden>
          {Array.from({ length: p.team_size }, (_, i) => (
            <span key={i} className={`h-4 w-4 rounded-[4px] border-[1.5px] border-ink ${i < p.member_count ? 'bg-lilac' : 'border-dashed bg-paper'}`} />
          ))}
        </span>
        <span className="font-semibold">{p.open_seats} seat{p.open_seats === 1 ? '' : 's'} open</span>
      </div>
      <div className="mt-5 border-t-2 border-ink/15 pt-4">
        {p.my_request === 'pending' ? (
          <Badge value="pending">Request pending</Badge>
        ) : open ? (
          <div className="space-y-2">
            <textarea aria-label="Message to the lead" className="input" rows={2} placeholder="Why you'd be a good fit (optional)" value={msg} onChange={(e) => setMsg(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <Button loading={loading} onClick={send}>Send request</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => setOpen(true)}>Request to join</button>
            {p.my_request === 'rejected' && <span className="self-center text-xs text-ink-mute">Previously rejected</span>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Discover() {
  useTitle('Discover')
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [skill, setSkill] = useState('')
  const [projects, setProjects] = useState(null)

  const load = () => api.get('/projects', { params: { q, skill } }).then((r) => setProjects(r.data))
  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [q, skill]) // eslint-disable-line react-hooks/exhaustive-deps

  const mySkills = (user.skills || []).map((s) => s.name)
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-8">
        <h2 className="font-display text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">Find your crew.</h2>
        <p className="mt-2 text-ink-soft">Sorted by how well your skills match. Highlighted skills are ones you have.</p>
      </div>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-ink-mute" />
          <input aria-label="Search projects" className="input pl-9" placeholder="Search projects…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <input aria-label="Filter by skill" className="input sm:w-48" placeholder="Filter by skill" value={skill} onChange={(e) => setSkill(e.target.value)} list="myskills" />
        <datalist id="myskills">{mySkills.map((s) => <option key={s} value={s} />)}</datalist>
      </div>
      {!mySkills.length && (
        <p className="mb-6 rounded-lg border-2 border-ink bg-sky/30 px-3 py-2 text-sm text-ink">
          Tip: <Link to="/" className="link">add your skills</Link> to get accurate match scores.
        </p>
      )}
      {projects === null ? (
        <p className="text-sm text-ink-mute">Loading…</p>
      ) : projects.length === 0 ? (
        <Empty icon={Compass} text="No open seats match that search. Every crew starts with one person, so it could be you.">
          <Link to="/new" className="btn-primary">Start your own project</Link>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => <ProjectCard key={p.id} p={p} mySkills={mySkills} onRequested={load} />)}
        </div>
      )}
    </div>
  )
}
