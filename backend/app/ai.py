"""All AI calls go through this file. Groq when a key is set, deterministic mock otherwise."""
import asyncio
import json
import os
from typing import List, Literal

from dotenv import load_dotenv
from pydantic import BaseModel, Field, ValidationError, field_validator

load_dotenv()
API_KEY = os.getenv("GROQ_API_KEY", "").strip()
MODEL_SMART = os.getenv("GROQ_MODEL_SMART", "openai/gpt-oss-120b")
MODEL_FAST = os.getenv("GROQ_MODEL_FAST", "openai/gpt-oss-20b")

_client = None
if API_KEY:
    try:
        from groq import AsyncGroq

        _client = AsyncGroq(api_key=API_KEY, timeout=20, max_retries=0)
    except Exception as e:  # noqa
        print("Groq client unavailable:", e)


# ---------- schemas ----------
class PlanTask(BaseModel):
    title: str
    description: str = ""
    phase: int = 1
    priority: Literal["low", "medium", "high"] = "medium"
    points: int = 3
    skills: List[str] = Field(default_factory=list)
    sprint: int = 1

    @field_validator("points")
    @classmethod
    def fib(cls, v):
        allowed = [1, 2, 3, 5, 8]
        return min(allowed, key=lambda a: abs(a - v))


class PlanSprint(BaseModel):
    name: str
    goal: str = ""


class Plan(BaseModel):
    sprints: List[PlanSprint] = Field(default_factory=list)
    tasks: List[PlanTask]


class SummaryOut(BaseModel):
    status: Literal["on_track", "at_risk", "off_track"]
    summary: str
    risks: List[str] = Field(default_factory=list)


# ---------- groq helpers ----------
async def _call(model: str, system: str, user: str, json_mode: bool) -> str:
    kwargs = dict(
        model=model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=0.2,
        max_tokens=4000,
    )
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    from groq import RateLimitError

    for attempt in range(2):
        try:
            res = await _client.chat.completions.create(**kwargs)
            return res.choices[0].message.content or ""
        except RateLimitError:
            if attempt == 0:
                await asyncio.sleep(2)
                continue
            raise
    raise RuntimeError("unreachable")


async def _structured(model: str, system: str, user: str, schema: type[BaseModel]):
    """Returns a validated model or None (caller falls back to mock)."""
    if not _client:
        return None
    try:
        raw = await _call(model, system, user, True)
        try:
            return schema.model_validate(json.loads(raw))
        except (json.JSONDecodeError, ValidationError) as err:
            raw = await _call(model, system, f"{user}\n\nYour previous reply was invalid: {str(err)[:400]}. Reply with valid JSON only.", True)
            return schema.model_validate(json.loads(raw))
    except Exception as e:  # timeout, 429 twice, bad json twice, network...
        print("AI fallback:", type(e).__name__, str(e)[:200], flush=True)
        return None


# ---------- planner ----------
PLAN_SYSTEM = """You are a project manager for a student software project.
Read the project description and plan the work as a sequence of sprints that fits what is being built.
Return JSON only, with exactly this schema:
{"sprints":[{"name":"string","goal":"string"}],"tasks":[{"title":"string","description":"string","phase":1,"priority":"low|medium|high","points":3,"skills":["React"],"sprint":1}]}
Rules: exactly the requested number of sprints, in order. Each sprint name is 1-3 words (e.g. "Foundations") and its goal is one sentence.
10 to 25 tasks. Every task has "sprint" = the 1-based sprint it belongs to; give every sprint some work and keep
sprint point totals roughly even. points must be one of 1, 2, 3, 5, 8. phase is an integer from 1 upward.
Include project setup in sprint 1, testing near the end and demo prep in the last sprint.
Keep titles short (max 8 words) and descriptions to one sentence. Use the project's own domain words in titles."""

MOCK_SPRINT_NAMES = ["Foundations", "Core build", "Features", "Integration", "Hardening", "Polish", "Demo prep"]


def mock_plan(title: str, skills: list[str], n_sprints: int = 3) -> dict:
    s = skills or ["General"]
    pick = lambda i: [s[i % len(s)]]  # noqa
    rows = [
        ("Set up repository and dev environment", 1, "high", 2),
        ("Write requirements and user stories", 1, "high", 3),
        ("Design wireframes and UI flow", 1, "medium", 3),
        ("Design data model", 1, "high", 3),
        ("Build core backend API", 2, "high", 8),
        ("Implement authentication", 2, "medium", 5),
        ("Build main frontend screens", 2, "high", 8),
        ("Connect frontend to API", 2, "medium", 5),
        ("Add secondary feature set", 3, "medium", 5),
        ("Write unit and integration tests", 3, "medium", 3),
        ("Fix bugs and polish UI", 3, "low", 3),
        ("Prepare demo, slides and README", 3, "high", 2),
    ]
    tasks = [{"title": t, "description": f"{t} for {title}.", "phase": ph, "priority": pr, "points": pts, "skills": pick(i)}
             for i, (t, ph, pr, pts) in enumerate(rows)]
    from .logic import assign_sprints  # local import: logic imports nothing from ai
    for t in assign_sprints(tasks, n_sprints):
        t["sprint"] = t.pop("sprint_index") + 1
    names = [MOCK_SPRINT_NAMES[min(len(MOCK_SPRINT_NAMES) - 1, round(i * (len(MOCK_SPRINT_NAMES) - 1) / max(1, n_sprints - 1)))]
             for i in range(n_sprints)] if n_sprints > 1 else ["Build it"]
    sprints = [{"name": n if names.count(n) == 1 else f"{n} {i + 1}", "goal": ""} for i, n in enumerate(names)]
    for i, sp in enumerate(sprints):
        first = [t["title"] for t in tasks if t["sprint"] == i + 1][:2]
        sp["goal"] = ("Deliver: " + " and ".join(first).lower() + ".") if first else "Buffer and catch-up."
    return {"sprints": sprints, "tasks": tasks}


async def generate_plan(title, description, skills, team_size, n_sprints, sprint_days):
    user = json.dumps({"title": title, "description": description[:900], "required_skills": skills,
                       "team_size": team_size, "sprints": n_sprints, "sprint_length_days": sprint_days})
    plan = await _structured(MODEL_SMART, PLAN_SYSTEM, user, Plan)
    if plan and len(plan.tasks) >= 3:
        sprints = [sp.model_dump() for sp in plan.sprints[:n_sprints]]
        sprints += [{"name": f"Sprint {i + 1}", "goal": ""} for i in range(len(sprints), n_sprints)]
        tasks = [t.model_dump() for t in plan.tasks[:25]]
        for t in tasks:
            t["sprint"] = max(1, min(n_sprints, t["sprint"]))
        return {"sprints": sprints, "tasks": tasks}, False
    return mock_plan(title, skills, n_sprints), True


# ---------- @ai in chat ----------
CHAT_SYSTEM = """You are CrewGrid AI, the project manager assistant for a student team.
Answer the question in at most 5 short sentences using only the context given. Be concrete: name people, tasks and dates.
You cannot change any data; if asked to, explain what the lead should do instead."""


def mock_chat(question: str, ctx: dict) -> str:
    open_tasks = ctx.get("open_tasks", [])
    if not open_tasks:
        return "AI offline — template used. There are no open tasks right now; the lead can generate a plan from the Plan tab."
    nxt = sorted(open_tasks, key=lambda t: t.get("deadline") or "9999")[:3]
    lines = "; ".join(f"{t['title']} ({t.get('owner') or 'unassigned'}, due {t.get('deadline')})" for t in nxt)
    return f"AI offline — template used. {len(open_tasks)} open tasks in the current sprint. Most urgent: {lines}."


async def chat_answer(question: str, ctx: dict):
    if _client:
        for _ in range(2):  # reasoning models occasionally return empty content; try once more
            try:
                text = await _call(MODEL_FAST, CHAT_SYSTEM, f"Context JSON: {json.dumps(ctx, default=str)}\n\nQuestion: {question}", False)
                if text.strip():
                    return text.strip(), False
            except Exception as e:
                print("AI chat fallback:", type(e).__name__, str(e)[:200], flush=True)
                break
    return mock_chat(question, ctx), True


# ---------- summary ----------
SUMMARY_SYSTEM = """You review a student project's progress. Return JSON only, with exactly this schema:
{"status":"on_track|at_risk|off_track","summary":"3 sentences","risks":["string"]}
Give 1 to 3 short risks."""


def mock_summary(stats: dict) -> dict:
    h = stats.get("health", 0)
    status = "on_track" if h >= 70 else "at_risk" if h >= 40 else "off_track"
    risks = []
    if stats.get("overdue_tasks"):
        risks.append(f"{len(stats['overdue_tasks'])} task(s) past their deadline")
    low = [m for m, p in stats.get("points_per_member", {}).items() if p == 0]
    if low:
        risks.append("No completed points yet: " + ", ".join(low))
    if stats.get("sprint_overdue"):
        risks.append("A sprint ended with unfinished work")
    return {
        "status": status,
        "summary": f"Project health is {h}/100. {stats.get('done_points', 0)} of {stats.get('total_points', 0)} points are done. "
                   f"The current sprint is {stats.get('sprint_progress', 0)}% complete.",
        "risks": risks or ["No major risks detected"],
    }


async def summarize(stats: dict):
    out = await _structured(MODEL_SMART, SUMMARY_SYSTEM, json.dumps(stats, default=str), SummaryOut)
    if out:
        return out.model_dump(), False
    return mock_summary(stats), True
