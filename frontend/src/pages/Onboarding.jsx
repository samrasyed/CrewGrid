import { useState } from 'react'
import api, { toast } from '../api'
import { useAuth } from '../App'
import { Button, Logo } from '../components/Badge'
import SkillEditor from '../components/SkillEditor'

// shown instead of the app to any account that has no skills yet (e.g. created before skills were required)
export default function Onboarding() {
  const { user, setUser } = useAuth()
  const [skills, setSkills] = useState([])
  const [bio, setBio] = useState(user.bio || '')
  const [saving, setSaving] = useState(false)
  const faculty = user.role === 'faculty'

  const save = async (e) => {
    e.preventDefault()
    if (!skills.length) return toast.error('Add at least one skill')
    setSaving(true)
    try {
      const r = await api.put('/me', { skills, bio })
      setUser(r.data)
      toast('Profile ready')
    } catch (err) {
      toast.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dot-grid flex min-h-screen flex-col px-4 sm:px-6">
      <header className="mx-auto flex w-full max-w-[1200px] items-center gap-2.5 py-6">
        <Logo size={30} />
        <span className="font-display text-xl font-extrabold tracking-tight">CrewGrid</span>
        <button className="ml-auto text-sm font-semibold hover:underline hover:underline-offset-4" onClick={() => setUser(null)}>Log out</button>
      </header>
      <main className="flex flex-1 items-center justify-center pb-16">
        <div className="w-full max-w-lg">
          <p className="eyebrow mb-3">One more thing</p>
          <h1 className="mb-2 font-display text-5xl font-extrabold leading-[0.95] tracking-[-0.03em]">
            {faculty ? 'What do you teach?' : 'What can you do?'}
          </h1>
          <p className="mb-8 text-ink-soft">
            {faculty ? 'Add your areas of expertise so students know who to ask.' : 'Skills power match scores and help leads pick their crew. Add at least one to continue.'}
          </p>
          <form onSubmit={save} className="sticker space-y-5 p-6 sm:p-7">
            <div><label className="label" htmlFor="ob-skill-name">{faculty ? 'Expertise' : 'Skills'}</label>
              <SkillEditor value={skills} onChange={setSkills} idPrefix="ob-skill" /></div>
            <div><label className="label" htmlFor="ob-bio">Short bio <span className="normal-case tracking-normal text-ink-mute">(optional)</span></label>
              <textarea id="ob-bio" className="input" rows={2} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} /></div>
            <Button loading={saving} className="w-full py-2.5" disabled={!skills.length}>Save and continue</Button>
          </form>
        </div>
      </main>
    </div>
  )
}
