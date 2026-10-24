import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, ChevronRight, Send } from 'lucide-react'
import api, { toast } from '../api'
import { useAuth } from '../App'
import Badge, { OfflineBanner, Spinner } from './Badge'

const BADGE_LABEL = { lead: 'Lead', member: 'Member', faculty: 'Faculty', ai: 'AI' }
const time = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

export default function ChatBox({ projectId, onCollapse }) {
  const { user } = useAuth()
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [offline, setOffline] = useState(false)
  const lastId = useRef(0)
  const bottom = useRef()

  useEffect(() => {
    lastId.current = 0
    setMsgs([])
    let alive = true
    const poll = () =>
      api.get(`/projects/${projectId}/messages`, { params: { after: lastId.current } }).then((r) => {
        if (!alive || !r.data.length) return
        lastId.current = r.data[r.data.length - 1].id
        setMsgs((m) => [...m, ...r.data.filter((x) => !m.some((y) => y.id === x.id))])
      }).catch(() => {})
    poll()
    const t = setInterval(poll, 3000)
    return () => { alive = false; clearInterval(t) }
  }, [projectId])

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length, thinking])

  const send = async (e) => {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    setSending(true)
    const isAi = body.toLowerCase().startsWith('@ai')
    if (isAi) setThinking(true)
    // optimistic: show own message immediately; poll de-dupes by id later
    try {
      const r = await api.post(`/projects/${projectId}/messages`, { body })
      setOffline(r.data.offline)
      const fresh = await api.get(`/projects/${projectId}/messages`, { params: { after: lastId.current } })
      if (fresh.data.length) {
        lastId.current = fresh.data[fresh.data.length - 1].id
        setMsgs((m) => [...m, ...fresh.data.filter((x) => !m.some((y) => y.id === x.id))])
      }
    } catch (err) {
      toast.error(err)
      setText(body)
    } finally {
      setSending(false)
      setThinking(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b-2 border-ink px-4">
        <h2 className="font-display text-base font-bold">Project chat</h2>
        {onCollapse && <button onClick={onCollapse} className="rounded-md p-1 text-ink-soft hover:bg-cream-dark hover:text-ink" aria-label="Collapse chat" title="Collapse chat"><ChevronRight size={16} /></button>}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {msgs.length === 0 && <p className="mx-auto max-w-[28ch] pt-10 text-center text-sm text-ink-soft">Quiet in here. Say hi, or type <b className="text-ink">@ai</b> and ask what to do next.</p>}
        {msgs.map((m) => {
          const mine = m.user_id === user.id
          return (
            <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              {!mine && (
                <div className="mb-1 flex items-center gap-1.5 text-xs">
                  {m.badge === 'ai' && <Bot size={13} className="text-ink" />}
                  {m.user_id ? <Link to={`/users/${m.user_id}`} className="font-semibold text-ink hover:underline hover:underline-offset-2">{m.name}</Link> : <span className="font-semibold text-ink">{m.name}</span>}
                  <Badge value={m.badge} className="!py-0 !text-[10px]">{BADGE_LABEL[m.badge]}</Badge>
                </div>
              )}
              <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
                mine ? 'rounded-br-sm border-2 border-ink bg-tomato text-ink' : m.badge === 'ai' ? 'rounded-bl-sm border-2 border-ink bg-mint/40 text-ink' : 'rounded-bl-sm border-2 border-ink bg-cream text-ink'}`}>
                {m.body}
              </div>
              <span className="mt-0.5 text-[10px] text-ink-mute">{time(m.created_at)}</span>
            </div>
          )
        })}
        {thinking && <div className="flex items-center gap-2 text-xs text-ink-mute"><Spinner size={12} /> CrewGrid AI is thinking…</div>}
        <div ref={bottom} />
      </div>
      {offline && <div className="px-4 pb-2"><OfflineBanner /></div>}
      <form onSubmit={send} className="flex gap-2 border-t-2 border-ink p-3">
        <input aria-label="Message" className="input" placeholder="Message, or @ai ask the PM…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-primary px-3" aria-label="Send" disabled={sending || !text.trim()}>{sending ? <Spinner size={14} /> : <Send size={14} />}</button>
      </form>
    </div>
  )
}
