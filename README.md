# CrewGrid

A student project portal that works like a lightweight Jira/Notion, with an AI project manager.
Students create or join projects. AI drafts the plan and splits it into equal sprints. Teams work a Kanban board and chat with faculty. Faculty watch every team's health.

**Stack:** FastAPI + SQLModel (SQLite) + Groq · Vite + React + Tailwind + dnd-kit + Recharts.

## Setup (4 commands)

Requires Python 3.11+ and Node 18+. From the repo root:

```bash
cd backend && python -m venv venv && venv/Scripts/pip install -r requirements.txt   # macOS/Linux: venv/bin/pip
venv/Scripts/python -m app.seed && venv/Scripts/python -m uvicorn app.main:app --port 8000   # macOS/Linux: venv/bin/python
cd frontend && npm install            # second terminal, from the repo root
npm run dev                           # open http://localhost:5173
```

Before the first run, copy `backend/.env.example` to `backend/.env`. The app works fully without a Groq key.
`python -m app.seed` wipes the database and reloads the demo data. Run it again any time to reset.

## Demo logins (password `demo123` for all)

| Who | Email | Notes |
|---|---|---|
| Faculty | faculty@crewgrid.dev | Faculty sign-up code: `FACULTY2026` |
| Alice | alice@crewgrid.dev | Lead of **Campus Food Finder** (healthy) |
| Dave | dave@crewgrid.dev | Lead of **Study Buddy Matcher** (sprint 1 is overdue) |
| Erin | erin@crewgrid.dev | Lead of **Green Campus Tracker** (recruiting, 2 pending requests) |
| Bob, Carol, Frank | bob@ / carol@ / frank@crewgrid.dev | Members |

**Demo of the overdue alert:** log in as faculty and click **Run checks now**. Faculty and Dave get a notification, and the alert is posted in the project chat. The background check runs every 60 s (the first run is 60 s after startup), so if you wait longer than that the alert will already have been sent.

## Adding the Groq key

1. Create a free key at https://console.groq.com/keys.
2. Put it in `backend/.env` as `GROQ_API_KEY=gsk_...`.
3. Restart the backend.

Model names come from `.env` (`GROQ_MODEL_SMART` for the planner, summaries and assistant; `GROQ_MODEL_FAST` for `@ai` chat). **Groq retires models from time to time, so check the current names at https://console.groq.com/docs/models.** The spec's defaults (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`) had already been retired when this was built, so the defaults are now `openai/gpt-oss-120b` and `openai/gpt-oss-20b`.

If there is no key, a call times out, or retries fail, CrewGrid uses a deterministic mock: a 12-task template plan, a rule-based summary and a template chat reply. The UI then shows an **"AI offline — template used"** banner.

## Layout

```
backend/app/   main.py (app, CORS, overdue loop) · routes.py (all /api routes) · models.py · auth.py · logic.py · ai.py · seed.py
frontend/src/  api.js · App.jsx · pages/{Landing,Login,Onboarding,Profile,Home,Discover,NewProject,Project,FacultyDashboard} ·
               components/{SkillEditor,Sidebar,NotificationBell,Board,TaskModal,ChatBox,PlanReview,ContributionChart,Badge}
```

API docs: http://localhost:8000/docs

## Design

The look is "a well-made student zine". It uses cream paper, ink type, and a few deliberate colour hits.
- **Tokens:** they live in `frontend/tailwind.config.js` (`cream`, `ink`, `paper`, `tomato`, `mustard`, `mint`, `sky`, `lilac`, `pink`). The shared classes (`.card`, `.sticker`, `.btn-*`, `.input`, `.eyebrow`) are in `src/index.css`.
- **Type:** headings use Bricolage Grotesque, and body text uses Figtree.
- **Surfaces:** a 2px ink border. The hard-offset shadow (`.sticker`) is kept for modals, popovers and the one hero object.
- **Landing page:** logged-out visitors see it at `/`. Logged-in users go straight to their home page.
- **Charts:** they use the brand colours in an order checked for colour-blind separation. Every bar has an ink outline and a legend, because the tokens are light.

## Projects, plans and profiles

- **Sign-up** has two steps, and at least one skill is required. Accounts created before that rule get a one-time "What can you do?" screen.
- **Leads** (and faculty) can delete a project or a single task. **Members** can leave a project. Their open tasks become unassigned, and work they finished stays credited to them.
- **Sprint length** can be 3 to 30 days. It is set when the project is created and can be changed in the Plan tab.
- **Planning:** the AI drafts named sprints with goals, based on the project description. The lead can rename sprints, move tasks between them, add or delete tasks, and use "Balance points evenly".
- **Re-planning:** "Edit current plan" reopens an accepted plan, for example with a new sprint length. Status and owners are kept.
- **Profiles** live at `/users/:id`. Each one shows skills, current and past projects, a weekly points chart, and three scores:
  - **Contribution:** your share of the team's finished work compared with an equal share, capped at 100.
  - **Consistency:** the share of your sprints in which you finished at least one task.
  - **On time:** finished tasks that met their deadline. Overdue open tasks count as late.
- **Database upgrade:** new database columns are added automatically on startup (`NEW_COLUMNS` in `models.py`), so existing databases keep working.

## Simplifying decisions

- **routes.py**: `main.py` grew past 400 lines, so the routes moved to `routes.py`, as the spec allows.
- **Permissions** are checked in one helper, `auth.require(db, user, project_id, *roles)`. Project roles are `lead`, `member` and `faculty`; faculty count as a role on every project.
- **Members** may only change the *status* of their *own* tasks. Leads and faculty can edit everything.
- **Accepting a new AI plan replaces** the project's existing sprints and tasks. Accepting also switches the project status from `recruiting` to `active`. Recruiting projects still show on Discover while they have open seats.
- **Faculty assign** obeys the team-size limit and auto-accepts any pending request from that student.
- **Sprint ranges:** each sprint is `sprint_days` long, and the last one is cut short at the project end date.
- **Contribution:** the chat bonus is +0.2 per message, counting at most 10 messages per sprint (so at most +2 per sprint). That is how "capped at 10 per sprint" was read.
- **Health:** "points expected by today" is the points of all finished sprints plus the elapsed share of the current sprint. A project with no tasks has health 100.
- **Profile editing** is on the student Home page; no separate profile page was built.
- **Extra endpoints:** `GET /my/tasks` and `GET /my/requests` were added for the student home page.
- **Toasts and refresh** use a tiny pub/sub in `api.js`, not a state library.
- **Times** are stored in UTC and shown in the browser's local time.
