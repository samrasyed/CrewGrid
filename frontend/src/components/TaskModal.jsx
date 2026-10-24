import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import api, { toast } from '../api'
import { Button } from './Badge'

export default function TaskModal({ task, projectId, sprintId, members, canEdit, canMove, onClose, onSaved, onDeleted }) {
  const isNew = !task.id
  const [form, setForm] = useState({
    title: task.title || '', description: task.description || '', assignee_id: task.assignee_id ?? '',
    priority: task.priority || 'medium', points: task.points || 3, deadline: task.deadline || '', status: task.status || 'todo',
  })
  const [saving, setSaving] = useState(false)
  const [sure, setSure] = useState(false)
  const remove = async () => {
    if (!sure) return setSure(true)
    setSaving(true)
    try {
      await api.delete(`/tasks/${task.id}`)
      toast('Task deleted')
      onDeleted()
    } catch (err) {
      toast.error(err)
      setSaving(false)
    }
  }
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const readOnly = !canEdit

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body = canEdit
        ? { ...form, points: Number(form.points), assignee_id: form.assignee_id === '' ? null : Number(form.assignee_id), deadline: form.deadline || null }
        : { status: form.status }
      if (isNew) await api.post(`/projects/${projectId}/tasks`, { ...body, sprint_id: sprintId })
      else await api.put(`/tasks/${task.id}`, body)
      toast(isNew ? 'Task created' : 'Task updated')
      onSaved()
    } catch (err) {
      toast.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onMouseDown={onClose}>
      <form onSubmit={save} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="tm-heading" className="sticker max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto p-6 shadow-hard-lg">
        <div className="flex items-center justify-between">
          <h2 id="tm-heading" className="font-display text-xl font-bold">{isNew ? 'New task' : 'Edit task'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-ink-soft hover:bg-cream-dark hover:text-ink"><X size={18} /></button>
        </div>
        <div><label className="label" htmlFor="tm-title">Title</label><input id="tm-title" className="input" required disabled={readOnly} value={form.title} onChange={set('title')} /></div>
        <div><label className="label" htmlFor="tm-description">Description</label><textarea id="tm-description" className="input" rows={2} disabled={readOnly} value={form.description} onChange={set('description')} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="tm-assignee">Assignee</label>
            <select id="tm-assignee" className="input" disabled={readOnly} value={form.assignee_id} onChange={set('assignee_id')}>
              <option value="">Unassigned</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="tm-status">Status</label>
            <select id="tm-status" className="input" disabled={!canMove && !canEdit} value={form.status} onChange={set('status')}>
              <option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="done">Done</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="tm-priority">Priority</label>
            <select id="tm-priority" className="input" disabled={readOnly} value={form.priority} onChange={set('priority')}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="tm-points">Points</label>
            <select id="tm-points" className="input" disabled={readOnly} value={form.points} onChange={set('points')}>
              {[1, 2, 3, 5, 8].map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="col-span-2"><label className="label" htmlFor="tm-deadline">Deadline</label><input id="tm-deadline" className="input" type="date" disabled={readOnly} value={form.deadline} onChange={set('deadline')} /></div>
        </div>
        {readOnly && <p className="text-xs text-ink-mute">{canMove ? 'You can change the status of your own task.' : 'Only the lead or faculty can edit this task.'}</p>}
        <div className="flex justify-end gap-2">
          {canEdit && !isNew && (
            <button type="button" className="btn-danger mr-auto" disabled={saving} onClick={remove}>
              {sure ? 'Click again to delete' : 'Delete task'}
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          {(canEdit || canMove) && <Button loading={saving}>Save</Button>}
        </div>
      </form>
    </div>
  )
}
