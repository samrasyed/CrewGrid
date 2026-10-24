import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { Calendar, Plus, Sparkles } from 'lucide-react'
import { fmtDate } from '../api'
import Badge, { Empty } from './Badge'

const COLUMNS = [
  { id: 'todo', title: 'To Do', dot: 'bg-paper' },
  { id: 'in_progress', title: 'In Progress', dot: 'bg-sky' },
  { id: 'done', title: 'Done', dot: 'bg-mint' },
]

function Card({ task, owner, canMove, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled: !canMove })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined
  const late = task.status !== 'done' && task.deadline && task.deadline < new Date().toISOString().slice(0, 10)
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(task)}
      className={`card cursor-pointer select-none p-3 text-sm transition-shadow hover:shadow-hard-sm ${isDragging ? 'relative z-50 rotate-[-2deg] shadow-hard' : ''} ${canMove ? 'cursor-grab' : ''}`}
    >
      <div className={`mb-2.5 font-semibold leading-snug ${task.status === 'done' ? 'text-ink-mute line-through decoration-2' : ''}`}>{task.title}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge value={task.priority} />
        <span className="rounded-md border-[1.5px] border-ink/30 px-1.5 text-[11px] font-bold">{task.points} pt</span>
        <span className={`flex items-center gap-1 text-xs ${late ? 'font-bold text-tomato-ink' : 'text-ink-mute'}`}>
          <Calendar size={11} />{fmtDate(task.deadline)}
        </span>
        <span className="ml-auto grid h-6 w-6 place-items-center rounded-md border-[1.5px] border-ink bg-lilac font-display text-[10px] font-bold text-ink" title={owner || 'Unassigned'}>
          {owner ? owner.split(' ').map((w) => w[0]).slice(0, 2).join('') : '?'}
        </span>
      </div>
    </div>
  )
}

function Column({ col, children, count }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })
  return (
    <div ref={setNodeRef} className={`flex min-h-[16rem] flex-col rounded-xl border-2 p-2.5 ${isOver ? 'border-ink bg-mustard/30' : 'border-ink/15 bg-cream-dark/60'}`}>
      <div className="mb-2.5 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-ink">
        <span aria-hidden className={`h-3 w-3 rounded-[3px] border-[1.5px] border-ink ${col.dot}`} />{col.title}<span className="rounded-full border-[1.5px] border-ink bg-paper px-1.5 text-[10px] font-bold text-ink">{count}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

export default function Board({ tasks, members, sprints, sprintId, setSprintId, canMove, canEdit, onMove, onOpen, onNew, onGoPlan }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }))
  const names = Object.fromEntries(members.map((m) => [m.id, m.name]))
  const shown = tasks.filter((t) => t.sprint_id === sprintId)
  const cur = sprints.find((s) => s.id === sprintId)

  if (!tasks.length) {
    return (
      <Empty icon={Sparkles} text={canEdit ? 'No tasks yet — let AI draft a plan and split it into sprints.' : 'No tasks yet — the team lead will generate a plan soon.'}>
        {canEdit && <button className="btn-primary" onClick={onGoPlan}><Sparkles size={14} /> Generate plan with AI</button>}
      </Empty>
    )
  }

  const handleEnd = ({ active, over }) => {
    if (!over) return
    const t = tasks.find((x) => x.id === active.id)
    if (t && t.status !== over.id) onMove(t, over.id)
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Sprints" className="flex flex-wrap gap-1 rounded-lg border-2 border-ink bg-paper p-1">
          {sprints.map((s) => (
            <button key={s.id} role="tab" aria-selected={s.id === sprintId} onClick={() => setSprintId(s.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-bold ${s.id === sprintId ? 'bg-ink text-cream' : 'text-ink-soft hover:bg-cream-dark hover:text-ink'}`}>
              Sprint {s.number}{s.name ? <span className="hidden font-medium opacity-70 xl:inline"> · {s.name}</span> : null}
            </button>
          ))}
        </div>
        {cur && (
          <span className="text-xs font-medium text-ink-soft">{fmtDate(cur.start)} – {fmtDate(cur.end)}</span>
        )}
        {canEdit && <button className="btn-ghost ml-auto py-1.5" onClick={onNew}><Plus size={14} /> Add task</button>}
      </div>
      {cur && (cur.name || cur.goal) && (
        <p className="-mt-2 mb-5 max-w-[70ch] text-sm text-ink-soft">
          {cur.name && <b className="font-display text-ink">{cur.name}</b>}{cur.name && cur.goal && ' — '}{cur.goal}
        </p>
      )}
      <DndContext sensors={sensors} onDragEnd={handleEnd}>
        <div className="grid gap-3 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = shown.filter((t) => t.status === col.id)
            return (
              <Column key={col.id} col={col} count={items.length}>
                {items.map((t) => <Card key={t.id} task={t} owner={names[t.assignee_id]} canMove={canMove(t)} onOpen={onOpen} />)}
              </Column>
            )
          })}
        </div>
      </DndContext>
    </div>
  )
}
