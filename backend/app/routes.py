from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from . import ai
from .auth import FACULTY_CODE, current_user, hash_password, make_token, project_role, require, verify_password
from .logic import (assign_members, assign_sprints, check_overdue, current_sprint, notify, project_stats,
                    sprint_ranges, user_profile)
from .models import JoinRequest, Member, Message, Notification, Project, Sprint, Summary, Task, User, get_session

router = APIRouter()
DB = Depends(get_session)
ME = Depends(current_user)


def user_out(u: User) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "role": u.role, "bio": u.bio, "skills": u.skills or []}


def skill_names(u: User) -> set:
    return {s["name"].lower() for s in (u.skills or [])}


def match_score(u: User, p: Project) -> int:
    req = {s.lower() for s in p.required_skills or []}
    return round(100 * len(req & skill_names(u)) / len(req)) if req else 100


def members_of(db: Session, pid: int) -> list[Member]:
    return db.exec(select(Member).where(Member.project_id == pid)).all()


def add_member(db: Session, p: Project, user_id: int):
    if db.get(Member, (p.id, user_id)):
        raise HTTPException(400, "Already a member")
    if len(members_of(db, p.id)) >= p.team_size:
        raise HTTPException(400, "Team is full")
    db.add(Member(project_id=p.id, user_id=user_id, role="member"))


# ---------------- auth ----------------
class RegisterIn(BaseModel):
    name: str
    email: str
    password: str
    role: str = "student"
    faculty_code: str = ""
    bio: str = ""
    skills: list = []


class LoginIn(BaseModel):
    email: str
    password: str


class ProfileIn(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[list] = None


SPRINT_MIN, SPRINT_MAX = 3, 30


def clean_skills(raw: list) -> list:
    out, seen = [], set()
    for s in raw or []:
        name = str((s or {}).get("name", "")).strip()[:40]
        if name and name.lower() not in seen:
            seen.add(name.lower())
            out.append({"name": name, "level": max(1, min(5, int(s.get("level", 3))))})
    return out


@router.post("/api/register")
def register(body: RegisterIn, db: Session = DB):
    if body.role not in ("student", "faculty"):
        raise HTTPException(400, "Invalid role")
    if body.role == "faculty" and body.faculty_code != FACULTY_CODE:
        raise HTTPException(400, "Wrong faculty code")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    email = body.email.strip().lower()
    if db.exec(select(User).where(User.email == email)).first():
        raise HTTPException(400, "Email already registered")
    skills = clean_skills(body.skills)
    if not skills:
        raise HTTPException(400, "Add at least one skill")
    u = User(name=body.name.strip(), email=email, role=body.role, password_hash=hash_password(body.password),
             bio=body.bio.strip()[:500], skills=skills)
    db.add(u)
    db.commit()
    db.refresh(u)
    return {"token": make_token(u), "user": user_out(u)}


@router.post("/api/login")
def login(body: LoginIn, db: Session = DB):
    u = db.exec(select(User).where(User.email == body.email.strip().lower())).first()
    if not u or not verify_password(body.password, u.password_hash):
        raise HTTPException(401, "Wrong email or password")
    return {"token": make_token(u), "user": user_out(u)}


@router.get("/api/me")
def me(user: User = ME):
    return user_out(user)


@router.put("/api/me")
def update_me(body: ProfileIn, user: User = ME, db: Session = DB):
    if body.name is not None:
        user.name = body.name
    if body.bio is not None:
        user.bio = body.bio[:500]
    if body.skills is not None:
        skills = clean_skills(body.skills)
        if not skills:
            raise HTTPException(400, "Keep at least one skill on your profile")
        user.skills = skills
    db.add(user)
    db.commit()
    return user_out(user)


# ---------------- projects ----------------
class ProjectIn(BaseModel):
    title: str
    description: str = ""
    required_skills: List[str] = []
    team_size: int = 5
    start_date: date
    end_date: date
    sprint_days: int = 14


def project_card(db: Session, p: Project, user: User | None = None) -> dict:
    ms = members_of(db, p.id)
    lead = db.get(User, p.lead_id)
    d = {**p.model_dump(), "start_date": str(p.start_date), "end_date": str(p.end_date),
         "lead_name": lead.name if lead else "", "member_count": len(ms), "open_seats": p.team_size - len(ms)}
    if user:
        d["match"] = match_score(user, p)
    return d


@router.post("/api/projects")
def create_project(body: ProjectIn, user: User = ME, db: Session = DB):
    if user.role != "student":
        raise HTTPException(403, "Only students create projects")
    if body.end_date <= body.start_date:
        raise HTTPException(400, "End date must be after start date")
    if not SPRINT_MIN <= body.sprint_days <= SPRINT_MAX:
        raise HTTPException(400, f"Sprint length must be {SPRINT_MIN}-{SPRINT_MAX} days")
    p = Project(**body.model_dump(), lead_id=user.id)
    p.team_size = max(1, min(20, p.team_size))
    db.add(p)
    db.commit()
    db.refresh(p)
    db.add(Member(project_id=p.id, user_id=user.id, role="lead"))
    db.commit()
    return project_card(db, p)


@router.get("/api/projects")
def discover(q: str = "", skill: str = "", user: User = ME, db: Session = DB):
    mine = {m.project_id for m in db.exec(select(Member).where(Member.user_id == user.id)).all()}
    reqs = {r.project_id: r.status for r in db.exec(select(JoinRequest).where(JoinRequest.user_id == user.id)).all()}
    out = []
    for p in db.exec(select(Project)).all():
        if p.id in mine:
            continue
        card = project_card(db, p, user)
        if card["open_seats"] <= 0:
            continue
        text = f"{p.title} {p.description} {' '.join(p.required_skills)}".lower()
        if q and q.lower() not in text:
            continue
        if skill and skill.lower() not in [s.lower() for s in p.required_skills]:
            continue
        card["my_request"] = reqs.get(p.id)
        out.append(card)
    return sorted(out, key=lambda c: -c["match"])


@router.get("/api/projects/{pid}")
def get_project(pid: int, user: User = ME, db: Session = DB):
    p = db.get(Project, pid)
    if not p:
        raise HTTPException(404, "Project not found")
    ms = members_of(db, pid)
    users = {u.id: u for u in db.exec(select(User).where(User.id.in_([m.user_id for m in ms]))).all()}
    sprints = sorted(db.exec(select(Sprint).where(Sprint.project_id == pid)).all(), key=lambda s: s.number)
    cur = current_sprint(sprints)
    return {**project_card(db, p, user), "my_role": project_role(db, user, pid),
            "members": [{**user_out(users[m.user_id]), "project_role": m.role} for m in ms if m.user_id in users],
            "sprints": [{"id": s.id, "number": s.number, "start": str(s.start), "end": str(s.end), "name": s.name, "goal": s.goal}
                        for s in sprints],
            "current_sprint_id": cur.id if cur else None}


@router.get("/api/my/projects")
def my_projects(user: User = ME, db: Session = DB):
    if user.role == "faculty":
        projects = db.exec(select(Project)).all()
    else:
        ids = [m.project_id for m in db.exec(select(Member).where(Member.user_id == user.id)).all()]
        projects = db.exec(select(Project).where(Project.id.in_(ids))).all() if ids else []
    return [{"id": p.id, "title": p.title, "badge": project_stats(db, p)["badge"], "my_role": project_role(db, user, p.id)}
            for p in projects]


# ---------------- join requests ----------------
class RequestIn(BaseModel):
    message: str = ""


@router.post("/api/projects/{pid}/requests")
def send_request(pid: int, body: RequestIn, user: User = ME, db: Session = DB):
    p = db.get(Project, pid)
    if not p:
        raise HTTPException(404, "Project not found")
    if user.role != "student" or db.get(Member, (pid, user.id)):
        raise HTTPException(400, "You can't request to join this project")
    if db.exec(select(JoinRequest).where(JoinRequest.project_id == pid, JoinRequest.user_id == user.id,
                                         JoinRequest.status == "pending")).first():
        raise HTTPException(400, "You already have a pending request")
    if len(members_of(db, pid)) >= p.team_size:
        raise HTTPException(400, "Team is full")
    db.add(JoinRequest(project_id=pid, user_id=user.id, message=body.message[:300]))
    notify(db, p.lead_id, f"{user.name} requested to join {p.title}", f"/projects/{pid}?tab=team")
    db.commit()
    return {"ok": True}


@router.get("/api/projects/{pid}/requests")
def list_requests(pid: int, user: User = ME, db: Session = DB):
    require(db, user, pid, "lead", "faculty")
    out = []
    for r in db.exec(select(JoinRequest).where(JoinRequest.project_id == pid, JoinRequest.status == "pending")).all():
        u = db.get(User, r.user_id)
        out.append({"id": r.id, "message": r.message, "user": user_out(u), "match": match_score(u, db.get(Project, pid))})
    return out


@router.get("/api/my/requests")
def my_requests(user: User = ME, db: Session = DB):
    out = []
    for r in db.exec(select(JoinRequest).where(JoinRequest.user_id == user.id)).all():
        p = db.get(Project, r.project_id)
        out.append({"id": r.id, "status": r.status, "message": r.message, "project_id": p.id, "project_title": p.title})
    return out


def decide(rid: int, accept: bool, user: User, db: Session):
    r = db.get(JoinRequest, rid)
    if not r or r.status != "pending":
        raise HTTPException(404, "Request not found")
    require(db, user, r.project_id, "lead")
    p = db.get(Project, r.project_id)
    if accept:
        add_member(db, p, r.user_id)
    r.status = "accepted" if accept else "rejected"
    db.add(r)
    notify(db, r.user_id, f"Your request to join {p.title} was {r.status}", f"/projects/{p.id}" if accept else "/discover")
    db.commit()
    return {"ok": True}


@router.post("/api/requests/{rid}/accept")
def accept_request(rid: int, user: User = ME, db: Session = DB):
    return decide(rid, True, user, db)


@router.post("/api/requests/{rid}/reject")
def reject_request(rid: int, user: User = ME, db: Session = DB):
    return decide(rid, False, user, db)


# ---------------- plan ----------------
class PlanTaskIn(BaseModel):
    id: Optional[int] = None  # set when re-planning an existing task (keeps status and owner)
    title: str
    description: str = ""
    phase: int = 1
    priority: str = "medium"
    points: int = 3
    skills: List[str] = []
    sprint: int = 1  # 1-based
    assignee_id: Optional[int] = None


class PlanSprintIn(BaseModel):
    name: str = ""
    goal: str = ""


class PlanDraftIn(BaseModel):
    sprint_days: Optional[int] = None


class PlanBalanceIn(BaseModel):
    tasks: List[PlanTaskIn]
    sprint_days: int


class PlanAcceptIn(BaseModel):
    tasks: List[PlanTaskIn]
    sprints: List[PlanSprintIn] = []
    sprint_days: Optional[int] = None


def sprint_count(p: Project, days: int) -> int:
    if not SPRINT_MIN <= days <= SPRINT_MAX:
        raise HTTPException(400, f"Sprint length must be {SPRINT_MIN}-{SPRINT_MAX} days")
    return len(sprint_ranges(p.start_date, p.end_date, days))


@router.post("/api/projects/{pid}/plan")
async def draft_plan(pid: int, body: PlanDraftIn = PlanDraftIn(), user: User = ME, db: Session = DB):
    require(db, user, pid, "lead", "faculty")
    p = db.get(Project, pid)
    days = body.sprint_days or p.sprint_days
    n = sprint_count(p, days)
    plan, offline = await ai.generate_plan(p.title, p.description, p.required_skills, p.team_size, n, days)
    return {**plan, "offline": offline, "sprint_days": days, "sprint_count": n}


@router.post("/api/projects/{pid}/plan/balance")
def balance_plan(pid: int, body: PlanBalanceIn, user: User = ME, db: Session = DB):
    """Re-spread draft tasks so every sprint gets about the same points (no data is saved)."""
    require(db, user, pid, "lead", "faculty")
    n = sprint_count(db.get(Project, pid), body.sprint_days)
    rows = [t.model_dump() | {"_i": i} for i, t in enumerate(body.tasks)]
    for t in assign_sprints(rows, n):
        t["sprint"] = t.pop("sprint_index") + 1
    return {"tasks": [{k: v for k, v in t.items() if k != "_i"} for t in sorted(rows, key=lambda t: t["_i"])]}


@router.post("/api/projects/{pid}/plan/accept")
def accept_plan(pid: int, body: PlanAcceptIn, user: User = ME, db: Session = DB):
    require(db, user, pid, "lead", "faculty")
    if not body.tasks:
        raise HTTPException(400, "Plan has no tasks")
    p = db.get(Project, pid)
    days = body.sprint_days or p.sprint_days
    n = sprint_count(p, days)
    p.sprint_days = days

    # rebuild sprints with the lead's names and goals
    for sp in db.exec(select(Sprint).where(Sprint.project_id == pid)).all():
        db.delete(sp)
    db.commit()
    sprints = []
    for i, (start, end) in enumerate(sprint_ranges(p.start_date, p.end_date, days)):
        meta = body.sprints[i] if i < len(body.sprints) else PlanSprintIn()
        sp = Sprint(project_id=pid, number=i + 1, start=start, end=end, name=meta.name.strip()[:40], goal=meta.goal.strip()[:200])
        db.add(sp)
        sprints.append(sp)
    db.commit()

    existing = {t.id: t for t in db.exec(select(Task).where(Task.project_id == pid)).all()}
    member_users = [db.get(User, m.user_id) for m in members_of(db, pid)]
    members = [{"id": u.id, "skills": skill_names(u)} for u in member_users]
    rows = []
    for t in body.tasks:
        row = t.model_dump() | {"points": t.points if t.points in (1, 2, 3, 5, 8) else 3,
                                "sprint_index": max(1, min(n, t.sprint)) - 1}
        old = existing.get(t.id)
        if old and old.status == "done":
            row["assignee_id"] = old.assignee_id  # finished work keeps its owner, even a former member
        rows.append(row)
    assign_members([r for r in rows if not (existing.get(r["id"]) and existing[r["id"]].status == "done")], members, n)

    counts, keep = {}, set()
    for r in rows:
        sp = sprints[r["sprint_index"]]
        task = existing.get(r["id"]) or Task(project_id=pid, title="")
        was = task.assignee_id
        task.sprint_id, task.title, task.description = sp.id, r["title"].strip()[:200] or "Untitled task", r["description"]
        task.phase, task.priority, task.points = r["phase"], r["priority"], r["points"]
        task.assignee_id, task.deadline = r["assignee_id"], sp.end
        db.add(task)
        if task.id:
            keep.add(task.id)
        if task.assignee_id and task.assignee_id != was and task.status != "done":
            counts[task.assignee_id] = counts.get(task.assignee_id, 0) + 1
    for tid, task in existing.items():
        if tid not in keep:
            db.delete(task)
    for uid, c in counts.items():
        if uid != user.id:
            notify(db, uid, f"You were assigned {c} task(s) in {p.title}", f"/projects/{pid}")
    p.status = "active"
    db.add(p)
    db.commit()
    return {"ok": True, "sprints": n}


# ---------------- tasks ----------------
class TaskIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    points: Optional[int] = None
    assignee_id: Optional[int] = None
    status: Optional[str] = None
    deadline: Optional[date] = None
    sprint_id: Optional[int] = None


def task_out(t: Task) -> dict:
    return {**t.model_dump(), "deadline": str(t.deadline) if t.deadline else None}


@router.get("/api/projects/{pid}/tasks")
def list_tasks(pid: int, user: User = ME, db: Session = DB):
    require(db, user, pid, "lead", "member", "faculty")
    return [task_out(t) for t in db.exec(select(Task).where(Task.project_id == pid)).all()]


@router.post("/api/projects/{pid}/tasks")
def create_task(pid: int, body: TaskIn, user: User = ME, db: Session = DB):
    require(db, user, pid, "lead", "faculty")
    sprints = db.exec(select(Sprint).where(Sprint.project_id == pid)).all()
    cur = current_sprint(sprints)
    sid = body.sprint_id or (cur.id if cur else None)
    sp = db.get(Sprint, sid) if sid else None
    t = Task(project_id=pid, sprint_id=sid, title=body.title or "New task", description=body.description or "",
             priority=body.priority or "medium", points=body.points or 3, assignee_id=body.assignee_id,
             status=body.status or "todo", deadline=body.deadline or (sp.end if sp else None))
    db.add(t)
    if t.assignee_id and t.assignee_id != user.id:
        notify(db, t.assignee_id, f"You were assigned: {t.title}", f"/projects/{pid}")
    db.commit()
    db.refresh(t)
    return task_out(t)


@router.put("/api/tasks/{tid}")
def update_task(tid: int, body: TaskIn, user: User = ME, db: Session = DB):
    t = db.get(Task, tid)
    if not t:
        raise HTTPException(404, "Task not found")
    role = require(db, user, t.project_id, "lead", "member", "faculty")
    changes = body.model_dump(exclude_unset=True)
    if role == "member":
        if t.assignee_id != user.id or set(changes) - {"status"}:
            raise HTTPException(403, "Members can only move their own tasks")
    if "status" in changes and changes["status"] not in ("todo", "in_progress", "done"):
        raise HTTPException(400, "Invalid status")
    old_assignee = t.assignee_id
    for k, v in changes.items():
        setattr(t, k, v)
    if "status" in changes:
        t.done_at = datetime.utcnow() if t.status == "done" else None
    if t.assignee_id and t.assignee_id != old_assignee and t.assignee_id != user.id:
        notify(db, t.assignee_id, f"You were assigned: {t.title}", f"/projects/{t.project_id}")
    db.add(t)
    db.commit()
    db.refresh(t)
    return task_out(t)


@router.get("/api/my/tasks")
def my_tasks(user: User = ME, db: Session = DB):
    tasks = db.exec(select(Task).where(Task.assignee_id == user.id, Task.status != "done")).all()
    titles = {p.id: p.title for p in db.exec(select(Project)).all()}
    out = [task_out(t) | {"project_title": titles.get(t.project_id, "")} for t in tasks]
    return sorted(out, key=lambda t: t["deadline"] or "9999")


# ---------------- chat ----------------
class MessageIn(BaseModel):
    body: str


def message_out(m: Message, users: dict, roles: dict) -> dict:
    u = users.get(m.user_id)
    return {"id": m.id, "body": m.body, "created_at": m.created_at.isoformat() + "Z", "user_id": m.user_id,
            "name": u.name if u else "CrewGrid AI", "badge": roles.get(m.user_id, "faculty") if u else "ai"}


def chat_lookup(db: Session, pid: int):
    users = {u.id: u for u in db.exec(select(User)).all()}
    roles = {m.user_id: m.role for m in members_of(db, pid)}
    return users, roles


@router.get("/api/projects/{pid}/messages")
def get_messages(pid: int, after: int = 0, user: User = ME, db: Session = DB):
    require(db, user, pid, "lead", "member", "faculty")
    msgs = db.exec(select(Message).where(Message.project_id == pid, Message.id > after).order_by(Message.id)).all()
    users, roles = chat_lookup(db, pid)
    return [message_out(m, users, roles) for m in msgs]


@router.post("/api/projects/{pid}/messages")
async def post_message(pid: int, body: MessageIn, user: User = ME, db: Session = DB):
    require(db, user, pid, "lead", "member", "faculty")
    text = body.body.strip()[:2000]
    if not text:
        raise HTTPException(400, "Empty message")
    db.add(Message(project_id=pid, user_id=user.id, body=text))
    db.commit()
    offline = False
    if text.lower().startswith("@ai"):
        p = db.get(Project, pid)
        users, roles = chat_lookup(db, pid)
        sprints = db.exec(select(Sprint).where(Sprint.project_id == pid)).all()
        cur = current_sprint(sprints)
        open_tasks = db.exec(select(Task).where(Task.project_id == pid, Task.status != "done",
                                                Task.sprint_id == (cur.id if cur else -1))).all()
        last = db.exec(select(Message).where(Message.project_id == pid).order_by(Message.id.desc()).limit(15)).all()
        ctx = {
            "project": p.title, "today": str(date.today()),
            "members": [f"{users[uid].name} ({r})" for uid, r in roles.items() if uid in users],
            "current_sprint": {"number": cur.number, "start": str(cur.start), "end": str(cur.end)} if cur else None,
            "open_tasks": [{"title": t.title, "owner": users[t.assignee_id].name if t.assignee_id in users else None,
                            "status": t.status, "deadline": str(t.deadline), "points": t.points} for t in open_tasks][:30],
            "recent_messages": [f"{users[m.user_id].name if m.user_id in users else 'AI'}: {m.body[:200]}" for m in reversed(last)],
        }
        answer, offline = await ai.chat_answer(text[3:].strip(), ctx)
        db.add(Message(project_id=pid, user_id=None, body=answer))
        db.commit()
    return {"ok": True, "offline": offline}


# ---------------- notifications ----------------
@router.get("/api/notifications")
def get_notifications(user: User = ME, db: Session = DB):
    rows = db.exec(select(Notification).where(Notification.user_id == user.id).order_by(Notification.id.desc()).limit(30)).all()
    unread = len(db.exec(select(Notification).where(Notification.user_id == user.id, Notification.read == False)).all())  # noqa
    return {"unread": unread, "items": [{**n.model_dump(), "created_at": n.created_at.isoformat() + "Z"} for n in rows]}


@router.post("/api/notifications/read")
def read_notifications(user: User = ME, db: Session = DB):
    for n in db.exec(select(Notification).where(Notification.user_id == user.id, Notification.read == False)).all():  # noqa
        n.read = True
        db.add(n)
    db.commit()
    return {"ok": True}


# ---------------- dashboards ----------------
def latest_summary(db: Session, pid: int):
    s = db.exec(select(Summary).where(Summary.project_id == pid).order_by(Summary.id.desc())).first()
    return s.data if s else None


@router.get("/api/projects/{pid}/stats")
def stats(pid: int, user: User = ME, db: Session = DB):
    require(db, user, pid, "lead", "member", "faculty")
    return {**project_stats(db, db.get(Project, pid)), "summary": latest_summary(db, pid)}


@router.post("/api/projects/{pid}/summary")
async def summary(pid: int, user: User = ME, db: Session = DB):
    require(db, user, pid, "lead", "member", "faculty")
    st = project_stats(db, db.get(Project, pid))
    compact = {k: st[k] for k in ("health", "progress", "total_points", "done_points", "open_tasks", "overdue_tasks",
                                  "sprint_overdue", "current_sprint", "sprint_count", "sprint_progress", "points_per_member")}
    compact["overdue_tasks"] = compact["overdue_tasks"][:10]
    out, offline = await ai.summarize(compact)
    out["offline"] = offline
    out["created_at"] = datetime.utcnow().isoformat() + "Z"
    db.add(Summary(project_id=pid, data=out))
    db.commit()
    return out


# ---------------- faculty ----------------
class AssignIn(BaseModel):
    project_id: int
    user_id: int


def require_faculty(user: User):
    if user.role != "faculty":
        raise HTTPException(403, "Faculty only")


@router.get("/api/faculty/projects")
def faculty_projects(user: User = ME, db: Session = DB):
    require_faculty(user)
    out = []
    for p in db.exec(select(Project)).all():
        st = project_stats(db, p)
        out.append({**project_card(db, p), "health": st["health"], "badge": st["badge"], "progress": st["progress"],
                    "current_sprint": st["current_sprint"], "overdue": st["sprint_overdue"] or bool(st["overdue_tasks"]),
                    "summary": latest_summary(db, p.id)})
    return out


@router.get("/api/faculty/students")
def faculty_students(user: User = ME, db: Session = DB):
    require_faculty(user)
    return [user_out(u) for u in db.exec(select(User).where(User.role == "student")).all()]


@router.post("/api/faculty/assign")
def faculty_assign(body: AssignIn, user: User = ME, db: Session = DB):
    require_faculty(user)
    p, u = db.get(Project, body.project_id), db.get(User, body.user_id)
    if not p or not u or u.role != "student":
        raise HTTPException(404, "Project or student not found")
    add_member(db, p, u.id)
    for r in db.exec(select(JoinRequest).where(JoinRequest.project_id == p.id, JoinRequest.user_id == u.id,
                                               JoinRequest.status == "pending")).all():
        r.status = "accepted"
        db.add(r)
    notify(db, u.id, f"{user.name} assigned you to {p.title}", f"/projects/{p.id}")
    notify(db, p.lead_id, f"{user.name} added {u.name} to {p.title}", f"/projects/{p.id}")
    db.commit()
    return {"ok": True}


@router.post("/api/faculty/run-checks")
def run_checks(user: User = ME, db: Session = DB):
    require_faculty(user)
    return {"alerts": check_overdue(db)}


# ---------------- delete / leave / profiles ----------------
@router.delete("/api/projects/{pid}")
def delete_project(pid: int, user: User = ME, db: Session = DB):
    require(db, user, pid, "lead", "faculty")
    p = db.get(Project, pid)
    for m in members_of(db, pid):
        if m.user_id != user.id:
            notify(db, m.user_id, f"{user.name} deleted the project {p.title}", "/")
    for model in (Task, Sprint, Member, JoinRequest, Message, Summary):
        for row in db.exec(select(model).where(model.project_id == pid)).all():
            db.delete(row)
    for n in db.exec(select(Notification).where(Notification.link.startswith(f"/projects/{pid}"))).all():
        if n.link.split("?")[0] == f"/projects/{pid}":
            db.delete(n)
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.post("/api/projects/{pid}/leave")
def leave_project(pid: int, user: User = ME, db: Session = DB):
    role = require(db, user, pid, "member", "lead")
    if role == "lead":
        raise HTTPException(400, "Leads can't leave their own project. Delete it instead.")
    p = db.get(Project, pid)
    db.delete(db.get(Member, (pid, user.id)))
    open_tasks = db.exec(select(Task).where(Task.project_id == pid, Task.assignee_id == user.id, Task.status != "done")).all()
    for t in open_tasks:  # finished work keeps their name for contribution history
        t.assignee_id = None
        db.add(t)
    extra = f" {len(open_tasks)} open task(s) are now unassigned." if open_tasks else ""
    notify(db, p.lead_id, f"{user.name} left {p.title}.{extra}", f"/projects/{pid}")
    db.add(Message(project_id=pid, user_id=None, body=f"{user.name} left the crew.{extra}"))
    db.commit()
    return {"ok": True}


@router.delete("/api/tasks/{tid}")
def delete_task(tid: int, user: User = ME, db: Session = DB):
    t = db.get(Task, tid)
    if not t:
        raise HTTPException(404, "Task not found")
    require(db, user, t.project_id, "lead", "faculty")
    db.delete(t)
    db.commit()
    return {"ok": True}


@router.get("/api/users/{uid}")
def get_profile(uid: int, user: User = ME, db: Session = DB):
    u = db.get(User, uid)
    if not u:
        raise HTTPException(404, "User not found")
    return {**user_out(u), "is_me": u.id == user.id, **user_profile(db, u)}
