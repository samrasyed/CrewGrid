import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { toast } from '../api'
import { useAuth } from '../App'
import { Button, Logo } from '../components/Badge'
import SkillEditor from '../components/SkillEditor'

export default function Login() {
  const { setUser } = useAuth()
  const [params] = useSearchParams()
  const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'login')
  const [role, setRole] = useState(params.get('role') === 'faculty' ? 'faculty' : 'student')
  const [form, setForm] = useState({ name: '', email: '', password: '', faculty_code: '', bio: '' })
  const [skills, setSkills] = useState([])
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    if (mode === 'register' && step === 1) return setStep(2)
    if (mode === 'register' && !skills.length) return toast.error('Add at least one skill')
    setLoading(true)
    try {
      const r = mode === 'login' ? await api.post('/login', form) : await api.post('/register', { ...form, role, skills })
      setUser(r.data.user, r.data.token)
      toast(`Welcome, ${r.data.user.name.split(' ')[0]}!`)
    } catch (err) {
      toast.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dot-grid flex min-h-screen flex-col px-4 sm:px-6">
      <header className="mx-auto flex w-full max-w-[1200px] items-center py-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="CrewGrid home">
          <Logo size={30} />
          <span className="font-display text-xl font-extrabold tracking-tight">CrewGrid</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center pb-16">
        <div className="w-full max-w-md">
          <h1 className="mb-2 font-display text-5xl font-extrabold leading-[0.95] tracking-[-0.03em]">
            {mode === 'login' ? 'Welcome back.' : step === 1 ? 'Start a crew.' : 'What can you do?'}
          </h1>
          <p className="mb-8 text-ink-soft">
            {mode === 'login' ? 'Your board missed you. Probably.' : step === 1 ? 'Takes a minute. Less than a group chat poll.'
              : role === 'faculty' ? 'Your areas of expertise, so students know who to ask.' : 'Your skills power match scores. Be honest, nobody checks. Yet.'}
          </p>
          <form onSubmit={submit} className="sticker space-y-4 p-6 sm:p-7">
            {(mode === 'login' || step === 1) && (
              <>
            {mode === 'register' && (
              <div role="radiogroup" aria-label="Account type" className="grid grid-cols-2 gap-1 rounded-lg border-2 border-ink bg-cream p-1 text-sm">
                {['student', 'faculty'].map((r) => (
                  <button type="button" role="radio" aria-checked={role === r} key={r} onClick={() => setRole(r)}
                    className={`rounded-md py-1.5 font-semibold capitalize ${role === r ? 'bg-ink text-cream' : 'text-ink-soft hover:text-ink'}`}>
                    {r}
                  </button>
                ))}
              </div>
            )}
            {mode === 'register' && (
              <div><label className="label" htmlFor="name">Full name</label><input id="name" className="input" required value={form.name} onChange={set('name')} /></div>
            )}
            <div><label className="label" htmlFor="email">Email</label><input id="email" className="input" type="email" required value={form.email} onChange={set('email')} /></div>
            <div><label className="label" htmlFor="pw">Password</label><input id="pw" className="input" type="password" required minLength={6} value={form.password} onChange={set('password')} /></div>
            {mode === 'register' && role === 'faculty' && (
              <div><label className="label" htmlFor="code">Faculty code</label><input id="code" className="input" required value={form.faculty_code} onChange={set('faculty_code')} placeholder="Ask your course admin" /></div>
            )}
              </>
            )}
            {mode === 'register' && step === 2 && (
              <>
                <div>
                  <label className="label" htmlFor="skill-name">{role === 'faculty' ? 'Expertise' : 'Skills'} <span className="normal-case tracking-normal text-ink-mute">(at least one)</span></label>
                  <SkillEditor value={skills} onChange={setSkills} />
                </div>
                <div><label className="label" htmlFor="bio">Short bio <span className="normal-case tracking-normal text-ink-mute">(optional)</span></label>
                  <textarea id="bio" className="input" rows={2} maxLength={500} value={form.bio} onChange={set('bio')} placeholder="What you like building, what you want to learn" /></div>
              </>
            )}
            <div className="flex gap-2">
              {mode === 'register' && step === 2 && <button type="button" className="btn-ghost" onClick={() => setStep(1)}>Back</button>}
              <Button loading={loading} className="flex-1 py-2.5">{mode === 'login' ? 'Log in' : step === 1 ? 'Next: your skills' : 'Create account'}</Button>
            </div>
            {mode === 'register' && <p className="text-center text-xs text-ink-mute">Step {step} of 2</p>}
            <p className="text-center text-sm text-ink-soft">
              {mode === 'login' ? 'New here? ' : 'Already have an account? '}
              <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setStep(1) }}>
                {mode === 'login' ? 'Create an account' : 'Log in'}
              </button>
            </p>
          </form>
          <p className="mt-6 text-center text-xs text-ink-mute">Demo: alice@crewgrid.dev or faculty@crewgrid.dev · password demo123</p>
        </div>
      </main>
    </div>
  )
}
