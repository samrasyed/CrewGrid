import { Loader2 } from 'lucide-react'

// flat fills, ink text, thin ink outline: every pair is >= 4.5:1
const COLORS = {
  green: 'bg-mint',
  amber: 'bg-mustard',
  red: 'bg-tomato',
  indigo: 'bg-sky',
  lilac: 'bg-lilac',
  pink: 'bg-pink',
  zinc: 'bg-cream-dark',
}

// maps domain values to a colour so callers can just pass the value
const AUTO = {
  high: 'red', medium: 'amber', low: 'zinc',
  todo: 'zinc', in_progress: 'indigo', done: 'green',
  lead: 'lilac', member: 'zinc', faculty: 'amber', ai: 'green',
  pending: 'amber', accepted: 'green', rejected: 'red',
  on_track: 'green', at_risk: 'amber', off_track: 'red',
  recruiting: 'pink', active: 'green',
}

const LABEL = { in_progress: 'In Progress', todo: 'To Do', on_track: 'On track', at_risk: 'At risk', off_track: 'Off track', ai: 'AI' }

export default function Badge({ value, color, children, className = '' }) {
  const c = color || AUTO[value] || 'zinc'
  const text = children ?? LABEL[value] ?? (value ? value[0].toUpperCase() + value.slice(1) : '')
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border-[1.5px] border-ink px-2 py-px text-[11px] font-bold leading-4 text-ink ${COLORS[c]} ${className}`}>
      {text}
    </span>
  )
}

export const DOT = { green: 'bg-mint', amber: 'bg-mustard', red: 'bg-tomato' }

export const HealthBadge = ({ badge, health }) => (
  <Badge color={badge}>
    {badge === 'green' ? 'Green' : badge === 'amber' ? 'Amber' : 'Red'}
    {health != null && <span className="ml-1 font-semibold opacity-80">{health}</span>}
  </Badge>
)

export const Logo = ({ size = 28 }) => (
  <span aria-hidden className="grid shrink-0 grid-cols-2 gap-[2px]" style={{ width: size, height: size }}>
    <span className="rounded-[3px] bg-tomato" />
    <span className="rounded-[3px] bg-mustard" />
    <span className="rounded-[3px] bg-mint" />
    <span className="rounded-[3px] bg-sky" />
  </span>
)

export const Avatar = ({ name = '?', className = 'h-8 w-8 text-xs', color = 'bg-mustard' }) => (
  <span className={`grid shrink-0 place-items-center rounded-lg border-2 border-ink font-display font-bold ${color} ${className}`} title={name}>
    {name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
  </span>
)

export const Spinner = ({ size = 16 }) => <Loader2 size={size} className="animate-spin" />

export function Button({ loading, children, variant = 'primary', className = '', ...props }) {
  return (
    <button className={`btn-${variant} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Spinner size={14} />}
      {children}
    </button>
  )
}

export const SkillChips = ({ skills = [], highlight = [] }) => {
  const hl = new Set(highlight.map((s) => s.toLowerCase()))
  return (
    <div className="flex flex-wrap gap-1">
      {skills.map((s) => {
        const name = typeof s === 'string' ? s : s.name
        const on = hl.has(name.toLowerCase())
        return (
          <span key={name} className={`rounded-md border-[1.5px] px-2 py-px text-xs font-medium ${on ? 'border-ink bg-mustard text-ink' : 'border-ink/20 bg-cream text-ink-soft'}`}>
            {name}
            {s.level && <span className="ml-1 font-semibold opacity-60">{s.level}</span>}
          </span>
        )
      })}
    </div>
  )
}

export const Empty = ({ icon: Icon, text, children }) => (
  <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-ink/40 px-6 py-14 text-center">
    {Icon && <Icon size={28} className="text-ink-soft" />}
    <p className="max-w-[44ch] text-sm text-ink-soft">{text}</p>
    {children}
  </div>
)

export const OfflineBanner = () => (
  <div className="inline-flex rounded-md border-[1.5px] border-ink bg-mustard px-2.5 py-1 text-xs font-semibold text-ink">AI offline — template used</div>
)

// section heading used inside cards
export const CardHead = ({ title, children }) => (
  <div className="flex flex-wrap items-center gap-3 border-b-2 border-ink px-5 py-3">
    <h3 className="font-display text-base font-bold">{title}</h3>
    {children}
  </div>
)

// small confirm dialog for destructive actions
export function Confirm({ title, children, confirmLabel = 'Confirm', loading, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onMouseDown={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(e) => e.stopPropagation()}
        className="sticker w-full max-w-md space-y-4 p-6 shadow-hard-lg">
        <h2 id="confirm-title" className="font-display text-xl font-bold">{title}</h2>
        <div className="text-sm text-ink-soft">{children}</div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} autoFocus>Cancel</button>
          <button className="btn border-2 border-ink bg-tomato text-ink hover:-translate-y-px" disabled={loading} onClick={onConfirm}>
            {loading && <Spinner size={14} />}{confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
