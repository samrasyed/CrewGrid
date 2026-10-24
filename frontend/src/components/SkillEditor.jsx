import { useState } from 'react'
import { Plus, X } from 'lucide-react'

const LEVELS = { 1: 'Beginner', 2: 'Basic', 3: 'Comfortable', 4: 'Strong', 5: 'Expert' }

// controlled editor for [{name, level}] — used at sign-up, onboarding and on the profile page
export default function SkillEditor({ value, onChange, idPrefix = 'skill' }) {
  const [name, setName] = useState('')
  const [level, setLevel] = useState(3)

  const add = () => {
    const n = name.trim()
    if (!n) return
    if (!value.some((s) => s.name.toLowerCase() === n.toLowerCase())) onChange([...value, { name: n, level: Number(level) }])
    setName('')
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input id={`${idPrefix}-name`} aria-label="Skill name" className="input" placeholder="e.g. React, Python, Figma" value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }} />
        <select aria-label="Skill level" className="input w-36 shrink-0" value={level} onChange={(e) => setLevel(e.target.value)}>
          {Object.entries(LEVELS).map(([l, label]) => <option key={l} value={l}>{l} · {label}</option>)}
        </select>
        <button type="button" className="btn-ghost shrink-0" onClick={add} aria-label="Add skill"><Plus size={16} /></button>
      </div>
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((s) => (
            <li key={s.name} className="inline-flex items-center gap-1.5 rounded-md border-[1.5px] border-ink bg-mustard py-1 pl-2 pr-1 text-xs font-semibold">
              {s.name}
              <select aria-label={`${s.name} level`} className="rounded bg-paper/70 px-0.5 text-[11px]" value={s.level}
                onChange={(e) => onChange(value.map((x) => (x.name === s.name ? { ...x, level: Number(e.target.value) } : x)))}>
                {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <button type="button" aria-label={`Remove ${s.name}`} className="rounded p-0.5 hover:bg-paper/70"
                onClick={() => onChange(value.filter((x) => x.name !== s.name))}><X size={12} /></button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-mute">Add at least one skill. Levels go from 1 (beginner) to 5 (expert).</p>
      )}
    </div>
  )
}
