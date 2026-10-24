import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Check, LogOut, MessageSquare, Trash2, X } from 'lucide-react'
import api, { emit, fmtDate, toast } from '../api'
import { useAuth, useTitle } from '../App'
import Badge, { Avatar, Button, Confirm, HealthBadge, SkillChips, Spinner } from '../components/Badge'
import Board from '../components/Board'
import TaskModal from '../components/TaskModal'
import ChatBox from '../components/ChatBox'
import PlanReview from '../components/PlanReview'
import ContributionChart from '../components/ContributionChart'

const CREW_COLORS = ['bg-tomato', 'bg-sky', 'bg-mustard', 'bg-mint', 'bg-lilac', 'bg-pink']

const TABS = [
  { id: 'board', label: 'Board' },
  { id: 'plan', label: 'Plan' },
  { id: 'team', label: 'Team & Requests' },
  { id: 'dashboard', label: 'Dashboard' },
]

function Team({ project, canDecide, onChange }) {
  const [requests, setRequests] = useState([])
  const [busy, setBusy] = useState(null)
  const load = useCallback(() => {
    if (canDecide) api.get(`/projects/${project.id}/requests`).then((r) => setRequests(r.data)).catch(() => {})
  }, [project.id, canDecide])
  useEffect(() => {
    load()
  }, [load])

  const decide = async (id, action) => {
    setBusy(id + action)
    try {
      await api.post(`/requests/${id}/${action}`)
      toast(action === 'accept' ? 'Added to the team' : 'Request rejected')
      load()
      onChange()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="font-display text-xl font-bold">The crew</h3>
          <span className="text-sm text-ink-soft">{project.member_count} of {project.team_size} seats filled</span>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {project.members.map((m, i) => (
            <li key={m.id} className="card flex gap-3 p-4">
              <Avatar name={m.name} className="h-12 w-12 rounded-xl text-base" color={CREW_COLORS[i % CREW_COLORS.length]} />
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold"><Link to={`/users/${m.id}`} className="truncate hover:underline hover:decoration-tomato hover:decoration-2 hover:underline-offset-4">{m.name}</Link> <Badge value={m.project_role} /></div>
                  <div className="truncate text-xs text-ink-mute">{m.email}</div>
                </div>
                <SkillChips skills={m.skills} highlight={project.required_skills} />
              </div>
            </li>
          ))}
          {Array.from({ length: Math.max(0, project.team_size - project.member_count) }, (_, i) => (
            <li key={`open-${i}`} className="flex items-center gap-3 rounded-xl border-2 border-dashed border-ink/50 p-4 text-sm text-ink-soft">
              <span className="grid h-12 w-12 place-items-center rounded-xl border-2 border-dashed border-ink/50 font-display text-xl">+</span>
              Seat open
            </li>
          ))}
        </ul>
      </div>
      {canDecide && (
        <div className="card">
          <div className="border-b-2 border-ink px-5 py-3 font-display font-bold">Pending requests</div>
          {requests.length === 0 && <p className="px-5 py-6 text-sm text-ink-mute">No pending requests.</p>}
          <ul className="divide-y divide-ink/15">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Link to={`/users/${r.user.id}`} className="hover:underline hover:decoration-tomato hover:decoration-2 hover:underline-offset-4">{r.user.name}</Link><Badge color={r.match >= 70 ? 'green' : r.match >= 40 ? 'amber' : 'zinc'}>{r.match}% match</Badge></div>
                  {r.message && <p className="text-sm italic text-ink-soft">“{r.message}”</p>}
                  <SkillChips skills={r.user.skills} highlight={project.required_skills} />
                </div>
                {project.my_role === 'lead' ? (
                  <div className="flex gap-2">
                    <Button variant="danger" loading={busy === r.id + 'reject'} onClick={() => decide(r.id, 'reject')}><X size={14} /> Reject</Button>
                    <Button loading={busy === r.id + 'accept'} onClick={() => decide(r.id, 'accept')}><Check size={14} /> Accept</Button>
                  </div>
                ) : <span className="text-xs text-ink-mute">Lead decides</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function Project() {
  const { id } = useParams()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'board'
  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [stats, setStats] = useState(null)
  const [sprintId, setSprintId] = useState(null)
  const [modal, setModal] = useState(null)
  const [chatOpen, setChatOpen] = useState(true)
  const [confirm, setConfirm] = useState(null) // 'delete' | 'leave'
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()
  useTitle(project?.title || 'Project')

  const role = project?.my_role
  const inTeam = !!role
  const canEdit = role === 'lead' || role === 'faculty'

  const load = useCallback(async () => {
    try {
      const p = (await api.get(`/projects/${id}`)).data
      setProject(p)
      setSprintId((cur) => (cur && p.sprints.some((s) => s.id === cur) ? cur : p.current_sprint_id))
      if (p.my_role) {
        const [t, s] = await Promise.all([api.get(`/projects/${id}/tasks`), api.get(`/projects/${id}/stats`)])
        setTasks(t.data)
        setStats(s.data)
      }
    } catch (e) {
      toast.error(e)
    }
  }, [id])

  useEffect(() => {
    setProject(null)
    setSprintId(null)
    load()
  }, [load])

  const setTab = (t) => setParams(t === 'board' ? {} : { tab: t })
  const canMove = (t) => canEdit || (role === 'member' && t.assignee_id === user.id)

  const move = async (task, status) => {
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status } : t)))
    try {
      await api.put(`/tasks/${task.id}`, { status })
      api.get(`/projects/${id}/stats`).then((r) => setStats(r.data))
      emit('projects')
    } catch (e) {
      toast.error(e)
      load()
    }
  }

  const destroy = async () => {
    setBusy(true)
    try {
      if (confirm === 'delete') await api.delete(`/projects/${id}`)
      else await api.post(`/projects/${id}/leave`)
      toast(confirm === 'delete' ? 'Project deleted' : `You left ${project.title}`)
      emit('projects')
      nav('/')
    } catch (e) {
      toast.error(e)
      setBusy(false)
    }
  }

  if (!project) return <div className="grid h-full place-items-center text-ink-mute"><Spinner size={22} /></div>

  if (!inTeam) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="sticker space-y-3 p-6">
          <h2 className="font-display text-2xl font-extrabold">{project.title}</h2>
          <p className="text-sm text-ink-soft">{project.description}</p>
          <SkillChips skills={project.required_skills} />
          <p className="text-sm text-ink-mute">You're not on this team. <Link to="/discover" className="link">Request to join from Discover</Link>.</p>
        </div>
      </div>
    )
  }

  const cs = stats?.current_sprint
  return (
    <div className="flex min-h-full flex-col lg:h-full lg:flex-row">
      <div className="min-w-0 flex-1 lg:overflow-y-auto">
        <div className="border-b-2 border-ink px-4 pt-6 md:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-1 font-display text-3xl font-extrabold tracking-[-0.03em]">{project.title}</h2>
            {stats && <HealthBadge badge={stats.badge} health={stats.health} />}
            {stats?.sprint_overdue && <Badge color="red">Sprint overdue</Badge>}
            <div className="ml-auto flex gap-2">
              {!chatOpen && (
                <button className="btn-ghost hidden py-1.5 lg:inline-flex" onClick={() => setChatOpen(true)}><MessageSquare size={14} /> Chat</button>
              )}
              {canEdit && <button className="btn-danger py-1.5" onClick={() => setConfirm('delete')}><Trash2 size={14} /> Delete</button>}
              {role === 'member' && <button className="btn-ghost py-1.5" onClick={() => setConfirm('leave')}><LogOut size={14} /> Leave</button>}
            </div>
          </div>
          <p className="mt-1.5 text-sm text-ink-soft">
            {cs ? `Sprint ${cs.number} of ${stats.sprint_count} · ${cs.days_left} days left · ` : 'No sprints yet · '}
            {fmtDate(project.start_date)} – {fmtDate(project.end_date)} · Lead {project.lead_name}
          </p>
          <div role="tablist" aria-label="Project sections" className="mt-5 flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={`tab ${tab === t.id ? 'border-tomato text-ink' : 'border-transparent text-ink-mute hover:text-ink'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 md:p-8">
          {tab === 'board' && (
            <Board tasks={tasks} members={project.members} sprints={project.sprints} sprintId={sprintId} setSprintId={setSprintId}
              canMove={canMove} canEdit={canEdit} onMove={move} onOpen={setModal} onNew={() => setModal({})} onGoPlan={() => setTab('plan')} />
          )}
          {tab === 'plan' && <PlanReview project={project} tasks={tasks} canEdit={canEdit} onAccepted={() => { load(); emit('projects'); setTab('board') }} />}
          {tab === 'team' && <Team project={project} canDecide={canEdit} onChange={load} />}
          {tab === 'dashboard' && stats && <ContributionChart projectId={project.id} stats={stats} onRefresh={load} />}
        </div>
      </div>
      {chatOpen && (
        <aside className="h-[28rem] shrink-0 border-t-2 border-ink bg-paper lg:h-full lg:w-1/3 lg:max-w-md lg:border-l-2 lg:border-t-0">
          <ChatBox projectId={project.id} onCollapse={() => setChatOpen(false)} />
        </aside>
      )}
      {!chatOpen && (
        <button className="btn-ghost m-4 lg:hidden" onClick={() => setChatOpen(true)}><MessageSquare size={14} /> Open chat</button>
      )}
      {confirm && (
        <Confirm title={confirm === 'delete' ? `Delete ${project.title}?` : `Leave ${project.title}?`}
          confirmLabel={confirm === 'delete' ? 'Delete project' : 'Leave project'} loading={busy}
          onConfirm={destroy} onClose={() => setConfirm(null)}>
          {confirm === 'delete'
            ? 'This removes the board, sprints, chat and requests for everyone. The team gets a notification. There is no undo.'
            : 'Your open tasks go back to the lead to reassign. Work you finished stays credited to you.'}
        </Confirm>
      )}
      {modal && (
        <TaskModal task={modal} projectId={project.id} sprintId={sprintId} members={project.members} canEdit={canEdit}
          canMove={modal.id ? canMove(modal) : false} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} onDeleted={() => { setModal(null); load() }} />
      )}
    </div>
  )
}
