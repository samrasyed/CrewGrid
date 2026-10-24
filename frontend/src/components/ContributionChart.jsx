import { useLayoutEffect, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import { Sparkles } from 'lucide-react'
import api, { toast } from '../api'
import Badge, { Button, OfflineBanner } from './Badge'

// brand palette ordered for colour-blind separation (validated); colour follows the member, in fixed order.
// The tokens are light, so every bar carries an ink outline and a legend/label for contrast relief.
export const PALETTE = ['#FF5C39', '#5AB2FF', '#FFC21A', '#46D39A', '#A98BFF', '#FF92C2']
const INK = '#1A1A1A'
const axis = { fontSize: 12, fill: '#4A453E', fontFamily: 'Figtree' }
const tip = {
  contentStyle: { borderRadius: 8, border: `2px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, fontSize: 12, fontFamily: 'Figtree' },
  cursor: { fill: 'rgba(26,26,26,0.06)' },
}

// measures its own width synchronously on mount (ResponsiveContainer can render at 0px inside grids)
export function Sized({ height, children }) {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    const measure = () => setWidth(Math.floor(el.getBoundingClientRect().width))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return <div ref={ref} className="w-full" style={{ height }}>{width > 0 && children(width)}</div>
}

export function SummaryCard({ summary }) {
  if (!summary) return null
  return (
    <div className="space-y-2 rounded-lg border-2 border-ink bg-cream p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge value={summary.status} />
        {summary.offline && <OfflineBanner />}
        {summary.created_at && <span className="ml-auto text-xs text-ink-mute">{new Date(summary.created_at).toLocaleString()}</span>}
      </div>
      <p className="text-ink-soft">{summary.summary}</p>
      {summary.risks?.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-ink-soft">{summary.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
      )}
    </div>
  )
}

export default function ContributionChart({ projectId, stats, onRefresh }) {
  const [loading, setLoading] = useState(false)
  const names = stats.member_names
  const color = Object.fromEntries(names.map((n, i) => [n, PALETTE[i % PALETTE.length]]))
  const cs = stats.current_sprint

  const summarize = async () => {
    setLoading(true)
    try {
      await api.post(`/projects/${projectId}/summary`)
      onRefresh()
    } catch (e) {
      toast.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><div className="eyebrow">Health</div><div className="mt-2 font-display text-4xl font-extrabold leading-none">{stats.health}<span className="text-sm text-ink-mute">/100</span></div></div>
        <div className="card p-5"><div className="eyebrow">Overall progress</div><div className="mt-2 font-display text-4xl font-extrabold leading-none">{stats.progress}%</div><div className="text-xs text-ink-mute">{stats.done_points} of {stats.total_points} pts</div></div>
        <div className="card p-5">
          <div className="eyebrow">{cs ? `Sprint ${cs.number} progress · ${cs.days_left} days left` : 'Current sprint'}</div>
          <div className="mt-2 font-display text-4xl font-extrabold leading-none">{stats.sprint_progress}%</div>
          <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-ink bg-paper">
            <div className="h-full bg-tomato transition-all" style={{ width: `${stats.sprint_progress}%` }} />
          </div>
          <div className="mt-1 text-xs text-ink-mute">{stats.sprint_points.done} of {stats.sprint_points.total} pts</div>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="font-display font-bold">AI summary</h3>
          <Button variant="ghost" loading={loading} onClick={summarize} className="ml-auto"><Sparkles size={14} /> {stats.summary ? 'Refresh summary' : 'Generate AI summary'}</Button>
        </div>
        {stats.summary ? <SummaryCard summary={stats.summary} /> : <p className="text-sm text-ink-mute">No summary yet.</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-display font-bold">Contribution</h3>
          <p className="mb-3 text-xs text-ink-mute">Done points weighted by priority + chat activity</p>
          <Sized height={240}>{(w) => (
            <BarChart width={w} height={240} data={stats.contribution} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(26,26,26,0.1)" />
              <XAxis dataKey="name" tick={axis} tickFormatter={(n) => n.split(' ')[0]} axisLine={false} tickLine={false} />
              <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...tip} formatter={(v, _, p) => [`${v} (${p.payload.share}% of team)`, 'Score']} />
              <Bar dataKey="score" isAnimationActive={false} radius={[4, 4, 0, 0]} maxBarSize={48} stroke={INK} strokeWidth={2} label={{ position: 'top', fontSize: 11, fontWeight: 600, fill: INK, formatter: (v) => v || '' }}>
                {stats.contribution.map((c) => <Cell key={c.user_id} fill={color[c.name]} />)}
              </Bar>
            </BarChart>
          )}</Sized>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-soft">
            {stats.contribution.map((c) => (
              <span key={c.user_id} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] border-[1.5px] border-ink" style={{ background: color[c.name] }} />{c.name} · {c.share}%</span>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-display font-bold">Points done per sprint</h3>
          <p className="mb-3 text-xs text-ink-mute">Stacked by member</p>
          {stats.per_sprint.length === 0 ? (
            <p className="py-16 text-center text-sm text-ink-mute">No sprints yet</p>
          ) : (
            <Sized height={262}>{(w) => (
              <BarChart width={w} height={262} data={stats.per_sprint} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(26,26,26,0.1)" />
                <XAxis dataKey="sprint" tick={axis} axisLine={false} tickLine={false} />
                <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...tip} />
                <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: INK }}>{v}</span>} />
                {names.map((n, i) => (
                  <Bar key={n} dataKey={n} stackId="a" isAnimationActive={false} fill={color[n]} stroke={INK} strokeWidth={1.5} maxBarSize={48}
                    radius={i === names.length - 1 ? [4, 4, 0, 0] : 0} />
                ))}
              </BarChart>
            )}</Sized>
          )}
        </div>
      </div>
    </div>
  )
}
