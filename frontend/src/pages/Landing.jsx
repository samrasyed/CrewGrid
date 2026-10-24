import { Link } from 'react-router-dom'
import { ArrowRight, Plus } from 'lucide-react'
import { Logo } from '../components/Badge'

// hand-arranged 4x4: the first 9 squares double as the 3x3 grid on small phones
const GRID = [
  { c: 'bg-tomato', who: 'R', name: 'Riya', skill: 'React' },
  { c: 'bg-sky' },
  { c: 'bg-mustard', who: 'J', name: 'Jonah', skill: 'Python' },
  { c: 'bg-lilac' },
  { c: 'bg-mint' },
  { c: 'bg-pink', who: 'A', name: 'Amara', skill: 'UI design' },
  { open: true },
  { c: 'bg-mustard' },
  { c: 'bg-sky', who: 'T', name: 'Tomás', skill: 'SQL' },
  { c: 'bg-lilac', who: 'M', name: 'Mei', skill: 'Testing' },
  { c: 'bg-tomato' },
  { c: 'bg-pink' },
  { c: 'bg-mint', who: 'K', name: 'Kofi', skill: 'Node.js' },
  { c: 'bg-sky' },
  { c: 'bg-mustard' },
  { c: 'bg-tomato' },
]

const STEPS = [
  { n: '01', title: 'Pitch it.', body: 'Post the project and the skills it needs.', fill: 'group-hover:text-mustard group-focus-within:text-mustard', shape: 'circle' },
  { n: '02', title: 'Find your crew.', body: 'Students see a match score. The lead picks who joins.', fill: 'group-hover:text-mint group-focus-within:text-mint', shape: 'triangle' },
  { n: '03', title: 'Split it.', body: 'AI cuts the work into equal sprints, so nobody carries the team.', fill: 'group-hover:text-sky group-focus-within:text-sky', shape: 'square' },
]

const Shape = ({ kind }) => {
  if (kind === 'circle') return <span aria-hidden className="block h-10 w-10 rounded-full bg-mustard" />
  if (kind === 'square') return <span aria-hidden className="block h-10 w-10 rounded-md bg-sky" />
  return (
    <svg aria-hidden width="44" height="40" viewBox="0 0 44 40"><path d="M22 2 42 38H2Z" className="fill-mint" /></svg>
  )
}

// flat skewed marker block behind a word (per word so it wraps cleanly)
const Marker = ({ children, color = 'bg-mustard' }) => (
  <span className="relative inline-block">
    <span aria-hidden className={`absolute -inset-x-[0.08em] bottom-[0.06em] top-[0.18em] -z-10 -skew-x-6 ${color}`} />
    {children}
  </span>
)

const Section = ({ children, className = '', label }) => (
  <section aria-label={label} className={`rule mx-auto max-w-[1200px] py-[72px] md:py-[120px] ${className}`}>{children}</section>
)

function CrewGrid() {
  return (
    <div className="relative w-full max-w-[300px] min-[480px]:max-w-[420px] lg:ml-auto">
      <div className="sticker rounded-2xl p-4 shadow-hard-lg sm:p-5">
        <div className="grid grid-cols-3 gap-2.5 min-[480px]:grid-cols-4 sm:gap-3">
          {GRID.map((s, i) => {
            const hideSmall = i >= 9 ? 'hidden min-[480px]:block' : ''
            if (s.open) {
              return (
                <div key={i} className={`relative ${hideSmall}`}>
                  <button aria-label="Open seat — 1 seat open on this crew"
                    className="grid aspect-square w-full place-items-center rounded-xl border-2 border-dashed border-ink bg-paper transition-transform hover:-translate-y-1">
                    <Plus size={22} strokeWidth={2.5} />
                  </button>
                  <span className="pointer-events-none absolute -bottom-5 -right-9 z-10 rotate-[-7deg] whitespace-nowrap rounded-md border-2 border-ink bg-mustard px-2 py-0.5 font-display text-sm font-bold shadow-hard-sm">
                    1 seat open
                  </span>
                </div>
              )
            }
            if (!s.who) return <div key={i} aria-hidden className={`aspect-square rounded-xl ${s.c} ${hideSmall}`} />
            return (
              <div key={i} className={`group relative ${hideSmall}`}>
                <button aria-label={`${s.name}, ${s.skill}`}
                  className={`grid aspect-square w-full place-items-center rounded-xl ${s.c} font-display text-2xl font-bold transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 sm:text-3xl`}>
                  {s.who}
                </button>
                <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border-2 border-ink bg-paper px-2 py-1 text-xs font-semibold group-focus-within:block group-hover:block">
                  {s.name} — {s.skill}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Landing() {
  return (
    <div className="dot-grid min-h-screen overflow-x-hidden px-4 sm:px-6 lg:px-10">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between py-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="CrewGrid home">
          <Logo size={30} />
          <span className="font-display text-xl font-extrabold tracking-tight">CrewGrid</span>
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link to="/login" className="text-sm font-semibold hover:underline hover:decoration-2 hover:underline-offset-4">Log in</Link>
          <Link to="/login?mode=register" className="btn border-2 border-ink bg-tomato text-ink hover:-translate-y-px">Start a crew</Link>
        </nav>
      </header>

      <main>
        {/* hero */}
        <section aria-labelledby="hero-title" className="mx-auto grid max-w-[1200px] items-center gap-16 pb-[72px] pt-10 md:pb-[120px] md:pt-16 lg:grid-cols-[1.45fr_1fr] lg:gap-12">
          <div>
            <p className="eyebrow mb-6">For class projects</p>
            <h1 id="hero-title" className="isolate font-display text-[clamp(3rem,7.5vw,6.5rem)] font-extrabold leading-[0.92] tracking-[-0.03em]">
              Group projects,{' '}
              <span className="relative inline-block">
                minus
                <svg aria-hidden viewBox="0 0 200 20" preserveAspectRatio="none" className="absolute -bottom-[0.12em] left-0 h-[0.16em] w-full overflow-visible">
                  <path d="M2 12 C 20 2, 36 20, 54 10 S 90 2, 106 11 S 142 20, 160 9 S 188 4, 198 10" fill="none" stroke="#FF5C39" strokeWidth="5" strokeLinecap="round" />
                </svg>
              </span>{' '}
              the <Marker>group</Marker> <Marker>chat</Marker> <Marker>chaos.</Marker>
            </h1>
            <p className="mt-8 max-w-[60ch] text-lg leading-relaxed text-ink-soft">
              Match skills, split work into equal sprints, and see who is actually shipping.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-6">
              <Link to="/login?mode=register" className="btn border-2 border-ink bg-tomato px-5 py-3 text-base text-ink hover:-translate-y-px">Start a crew</Link>
              <Link to="/login?mode=register&role=faculty" className="group inline-flex items-center gap-1.5 font-semibold underline decoration-2 underline-offset-4">
                I teach here <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
          <CrewGrid />
        </section>

        {/* statement */}
        <Section label="Why CrewGrid">
          <p className="isolate max-w-[22ch] font-display text-[clamp(2rem,4.5vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.02em] sm:max-w-[26ch]">
            Every group project has <Marker color="bg-tomato">one</Marker> <Marker color="bg-tomato">person</Marker> doing everything.
            CrewGrid makes it visible, then makes it{' '}
            <span className="underline decoration-mint-ink decoration-[0.12em] underline-offset-[0.14em]">fair.</span>
          </p>
        </Section>

        {/* how it works */}
        <Section label="How it works" className="!pb-0">
          <h2 className="eyebrow mb-10">How it works</h2>
          <ol>
            {STEPS.map((s) => (
              <li key={s.n} tabIndex={0} className="group rule grid grid-cols-[auto_1fr] items-center gap-x-6 py-8 outline-none focus-visible:outline-offset-[-3px] sm:grid-cols-[auto_1fr_auto] sm:gap-x-10 md:py-10">
                <span aria-hidden className={`inline-block w-[5.25rem] font-display text-[4rem] font-extrabold leading-none text-transparent md:w-[9.25rem] transition-colors [-webkit-text-stroke:2px_#1A1A1A] md:text-[7rem] ${s.fill}`}>
                  {s.n}
                </span>
                <div>
                  <h3 className="font-display text-2xl font-bold md:text-3xl"><span className="sr-only">Step {s.n}: </span>{s.title}</h3>
                  <p className="mt-1 max-w-[46ch] text-base text-ink-soft md:text-lg">{s.body}</p>
                </div>
                <div className="hidden sm:block"><Shape kind={s.shape} /></div>
              </li>
            ))}
          </ol>
        </Section>

        {/* audience + CTA */}
        <Section label="Who it's for">
          <div className="grid overflow-hidden rounded-2xl border-2 border-ink md:grid-cols-2">
            <div className="border-b-4 border-ink bg-lilac p-8 md:border-b-0 md:border-r-4 md:p-12">
              <h2 className="font-display text-4xl font-extrabold md:text-5xl">Students</h2>
              <p className="mt-4 max-w-[38ch] text-lg">Find teammates who fit, and get credit for the work you did.</p>
              <Link to="/login?mode=register" className="group mt-8 inline-flex items-center gap-1.5 font-semibold underline decoration-2 underline-offset-4">
                Join as a student <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="bg-paper p-8 md:p-12">
              <h2 className="font-display text-4xl font-extrabold md:text-5xl">Faculty</h2>
              <p className="mt-4 max-w-[38ch] text-lg">See which sprint slipped and who is behind, before the deadline does.</p>
              <Link to="/login?mode=register&role=faculty" className="group mt-8 inline-flex items-center gap-1.5 font-semibold underline decoration-2 underline-offset-4">
                Set up your class <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
          <div className="mt-[72px] flex flex-col items-start gap-8 md:mt-[120px] md:flex-row md:items-end md:justify-between">
            <h2 className="font-display text-[clamp(3rem,8vw,7rem)] font-extrabold leading-[0.9] tracking-[-0.03em]">Your crew is waiting.</h2>
            <Link to="/login?mode=register" className="btn shrink-0 border-2 border-ink bg-tomato px-6 py-3.5 text-lg text-ink hover:-translate-y-px">Start a crew</Link>
          </div>
        </Section>
      </main>

      <footer className="rule mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 py-6 text-sm text-ink-soft">
        <span>CrewGrid · built for class projects · October 2026</span>
        <Link to="/login" className="font-semibold text-ink hover:underline hover:underline-offset-4">Log in</Link>
      </footer>
    </div>
  )
}
