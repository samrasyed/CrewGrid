import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import api, { emit } from '../api'

const ago = (iso) => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.round(m / 60)}h ago`
  return `${Math.round(m / 1440)}d ago`
}

export default function NotificationBell() {
  const [data, setData] = useState({ unread: 0, items: [] })
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const nav = useNavigate()

  useEffect(() => {
    let last = 0
    const load = () =>
      api.get('/notifications').then((r) => {
        // a new notification may mean we joined a project: refresh the sidebar
        if (r.data.unread > last) emit('projects')
        last = r.data.unread
        setData(r.data)
      }).catch(() => {})
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const toggle = () => {
    setOpen(!open)
    if (!open && data.unread) {
      api.post('/notifications/read')
      setData((d) => ({ ...d, unread: 0 }))
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ''}`} className="relative rounded-lg border-2 border-ink bg-paper p-2 text-ink hover:bg-cream-dark">
        <Bell size={18} />
        {data.unread > 0 && (
          <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full border-2 border-ink bg-tomato px-1 text-[10px] font-bold text-ink">
            {data.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="sticker absolute right-0 z-40 mt-3 max-h-96 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto">
          <div className="border-b-2 border-ink px-4 py-2.5 font-display text-sm font-bold">Notifications</div>
          {data.items.length === 0 && <p className="px-4 py-6 text-center text-sm text-ink-mute">Nothing new. Suspiciously quiet.</p>}
          {data.items.map((n) => (
            <button
              key={n.id}
              onClick={() => { setOpen(false); n.link && nav(n.link) }}
              className={`block w-full border-b border-ink/15 px-4 py-2.5 text-left text-sm last:border-0 hover:bg-cream ${n.read ? 'text-ink-mute' : 'font-medium text-ink'}`}
            >
              <div className="flex gap-2">
                {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full border border-ink bg-tomato" />}
                <span>{n.text}</span>
              </div>
              <div className="mt-0.5 text-xs font-normal text-ink-mute">{ago(n.created_at)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
