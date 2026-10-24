"""Plain-Python business logic: sprint split, scores, overdue check, notifications."""
import math
from collections import defaultdict
from datetime import date, timedelta

from sqlmodel import Session, select

from .models import Member, Message, Notification, Project, Sprint, Task, User

PRIORITY_RANK = {"high": 0, "medium": 1, "low": 2}
PRIORITY_WEIGHT = {"high": 1.5, "medium": 1.2, "low": 1.0}


def notify(db: Session, user_id: int, text: str, link: str = ""):
    db.add(Notification(user_id=user_id, text=text, link=link))


# ---------- sprints ----------
def sprint_ranges(start: date, end: date, days: int) -> list[tuple[date, date]]:
    n = max(1, math.ceil((end - start).days / days))
    out = []
    for i in range(n):
        s = start + timedelta(days=i * days)
        e = min(s + timedelta(days=days - 1), end) if i < n - 1 else end
        out.append((s, e))
    return out


def assign_sprints(tasks: list[dict], n_sprints: int) -> list[dict]:
    """Equal-points split: sets 'sprint_index' on each task (sorted by phase, then priority)."""
    tasks = sorted(tasks, key=lambda t: (t.get("phase", 1), PRIORITY_RANK.get(t.get("priority"), 1)))
    target = sum(t["points"] for t in tasks) / max(1, n_sprints)
    idx, load = 0, 0
    for t in tasks:
        if idx < n_sprints - 1 and load > 0 and load + t["points"] > target + t["points"] / 2:
            idx, load = idx + 1, 0
        t["sprint_index"] = idx
        load += t["points"]
    return tasks


def assign_members(tasks: list[dict], members: list[dict], n_sprints: int) -> list[dict]:
    """Balance owners inside each sprint. Tasks that already have a valid 'assignee_id' keep it
    and count towards that member's load; the rest go to the least-loaded member (skill match breaks ties)."""
    valid = {m["id"] for m in members}
    for s in range(n_sprints):
        in_sprint = [t for t in tasks if t["sprint_index"] == s]
        loads = {m["id"]: 0 for m in members}
        for t in in_sprint:
            if t.get("assignee_id") in valid:
                loads[t["assignee_id"]] += t["points"]
        for t in sorted((t for t in in_sprint if t.get("assignee_id") not in valid), key=lambda t: -t["points"]):
            if not members:
                t["assignee_id"] = None
                continue
            want = {k.lower() for k in t.get("skills", [])}
            best = min(members, key=lambda m: (loads[m["id"]], 0 if want & m["skills"] else 1))
            t["assignee_id"] = best["id"]
            loads[best["id"]] += t["points"]
    return tasks


def split_tasks(tasks: list[dict], members: list[dict], n_sprints: int) -> list[dict]:
    """Equal sprint split + balanced owners (used by the seed and as the default plan)."""
    for t in tasks:
        t.pop("assignee_id", None)
    return assign_members(assign_sprints(tasks, n_sprints), members, n_sprints)


def current_sprint(sprints: list[Sprint], today: date | None = None) -> Sprint | None:
    today = today or date.today()
    if not sprints:
        return None
    sprints = sorted(sprints, key=lambda s: s.number)
    for s in sprints:
        if s.start <= today <= s.end:
            return s
    return sprints[-1] if today > sprints[-1].end else sprints[0]


# ---------- scores ----------
def project_stats(db: Session, p: Project) -> dict:
    today = date.today()
    tasks = db.exec(select(Task).where(Task.project_id == p.id)).all()
    sprints = sorted(db.exec(select(Sprint).where(Sprint.project_id == p.id)).all(), key=lambda s: s.number)
    member_rows = db.exec(select(Member).where(Member.project_id == p.id)).all()
    users = {u.id: u for u in db.exec(select(User).where(User.id.in_([m.user_id for m in member_rows]))).all()} if member_rows else {}
    names = {uid: u.name for uid, u in users.items()}
    cur = current_sprint(sprints, today)

    total_pts = sum(t.points for t in tasks)
    done_pts = sum(t.points for t in tasks if t.status == "done")
    open_tasks = [t for t in tasks if t.status != "done"]
    overdue = [t for t in open_tasks if t.deadline and t.deadline < today]

    # points expected by today: finished sprints fully + elapsed share of the current one
    expected = 0.0
    for s in sprints:
        pts = sum(t.points for t in tasks if t.sprint_id == s.id)
        if s.end < today:
            expected += pts
        elif s.start <= today:
            span = (s.end - s.start).days + 1
            expected += pts * ((today - s.start).days + 1) / span
    ratio = 1.0 if expected == 0 else min(1.0, done_pts / expected)
    health = round(100 * (0.6 * ratio + 0.4 * (1 - len(overdue) / max(1, len(open_tasks)))))
    sprint_overdue = any(s.end < today and any(t.status != "done" for t in tasks if t.sprint_id == s.id) for s in sprints)
    if sprint_overdue:
        health = min(health, 69)
    if not tasks:
        health = 100
    badge = "green" if health >= 70 else "amber" if health >= 40 else "red"

    # contribution
    msgs = db.exec(select(Message).where(Message.project_id == p.id, Message.user_id != None)).all()  # noqa
    contrib = defaultdict(float)
    for t in tasks:
        if t.status == "done" and t.assignee_id:
            contrib[t.assignee_id] += t.points * PRIORITY_WEIGHT.get(t.priority, 1)
    chat_counts = defaultdict(int)  # (user, sprint_id) -> count
    for m in msgs:
        sid = next((s.id for s in sprints if s.start <= m.created_at.date() <= s.end), 0)
        chat_counts[(m.user_id, sid)] += 1
    for (uid, _), c in chat_counts.items():
        if uid in names:
            contrib[uid] += 0.2 * min(c, 10)  # at most 10 messages (2 pts) counted per sprint
    team_total = sum(contrib[uid] for uid in names) or 1
    contribution = [
        {"user_id": uid, "name": names[uid], "score": round(contrib[uid], 1), "share": round(100 * contrib[uid] / team_total)}
        for uid in names
    ]

    per_sprint = []
    for s in sprints:
        row = {"sprint": f"S{s.number}"}
        for uid, n in names.items():
            row[n] = sum(t.points for t in tasks if t.sprint_id == s.id and t.assignee_id == uid and t.status == "done")
        per_sprint.append(row)

    cur_tasks = [t for t in tasks if cur and t.sprint_id == cur.id]
    cur_total = sum(t.points for t in cur_tasks)
    cur_done = sum(t.points for t in cur_tasks if t.status == "done")

    return {
        "health": health,
        "badge": badge,
        "progress": round(100 * done_pts / total_pts) if total_pts else 0,
        "total_points": total_pts,
        "done_points": done_pts,
        "open_tasks": len(open_tasks),
        "overdue_tasks": [{"title": t.title, "owner": names.get(t.assignee_id, "unassigned"), "deadline": str(t.deadline)} for t in overdue],
        "sprint_overdue": sprint_overdue,
        "current_sprint": {"id": cur.id, "number": cur.number, "start": str(cur.start), "end": str(cur.end),
                           "days_left": max(0, (cur.end - today).days)} if cur else None,
        "sprint_count": len(sprints),
        "sprint_progress": round(100 * cur_done / cur_total) if cur_total else 0,
        "sprint_points": {"done": cur_done, "total": cur_total},
        "contribution": contribution,
        "per_sprint": per_sprint,
        "member_names": list(names.values()),
        "points_per_member": {c["name"]: c["score"] for c in contribution},
    }


# ---------- overdue check ----------
def check_overdue(db: Session) -> int:
    today = date.today()
    fired = 0
    faculty = db.exec(select(User).where(User.role == "faculty")).all()
    for s in db.exec(select(Sprint).where(Sprint.alerted == False, Sprint.end < today)).all():  # noqa
        unfinished = db.exec(select(Task).where(Task.sprint_id == s.id, Task.status != "done")).all()
        if not unfinished:
            continue
        p = db.get(Project, s.project_id)
        owners = {u.id: u.name for u in db.exec(select(User)).all()}
        items = ", ".join(f"{t.title} ({owners.get(t.assignee_id, 'unassigned')})" for t in unfinished)
        text = f"Sprint {s.number} of {p.title} is overdue with {len(unfinished)} unfinished task(s): {items}"
        link = f"/projects/{p.id}"
        for f in faculty:
            notify(db, f.id, text, link)
        notify(db, p.lead_id, text, link)
        db.add(Message(project_id=p.id, user_id=None, body=f"⚠️ {text}"))
        s.alerted = True
        db.add(s)
        fired += 1
    db.commit()
    return fired


# ---------- user profile ----------
def user_profile(db: Session, user: User) -> dict:
    """Projects a user is in or has contributed to, plus three 0-100 scores:
    contribution (share of team work vs an equal share), consistency (sprints with at least one
    task finished) and on-time (done by the deadline; overdue open tasks count as late)."""
    today = date.today()
    memberships = {m.project_id: m.role for m in db.exec(select(Member).where(Member.user_id == user.id)).all()}
    my_tasks = db.exec(select(Task).where(Task.assignee_id == user.id)).all()
    project_ids = set(memberships) | {t.project_id for t in my_tasks if t.status == "done"}
    projects = {p.id: p for p in db.exec(select(Project).where(Project.id.in_(project_ids)))} if project_ids else {}

    rows, contrib_scores = [], []
    for pid, p in projects.items():
        tasks = db.exec(select(Task).where(Task.project_id == pid)).all()
        done = [t for t in tasks if t.status == "done" and t.assignee_id]
        weight = lambda t: t.points * PRIORITY_WEIGHT.get(t.priority, 1)  # noqa
        team_total = sum(weight(t) for t in done)
        mine = [t for t in done if t.assignee_id == user.id]
        my_total = sum(weight(t) for t in mine)
        team_n = max(1, len(members_of_project(db, pid)), len({t.assignee_id for t in done}))
        share = my_total / team_total if team_total else 0
        if team_total:
            contrib_scores.append(min(100, 100 * share * team_n))
        rows.append({"id": pid, "title": p.title, "status": p.status, "role": memberships.get(pid, "former"),
                     "current": pid in memberships, "points_done": sum(t.points for t in mine),
                     "tasks_done": len(mine), "share": round(100 * share)})
    rows.sort(key=lambda r: (not r["current"], -r["points_done"]))

    # consistency: sprints (started) where the user owned work; ongoing sprints only count once they deliver
    sprint_ids = {t.sprint_id for t in my_tasks if t.sprint_id}
    sprints = db.exec(select(Sprint).where(Sprint.id.in_(sprint_ids))).all() if sprint_ids else []
    counted = hits = 0
    for s in sprints:
        if s.start > today:
            continue
        delivered = any(t.sprint_id == s.id and t.status == "done" for t in my_tasks)
        if s.end < today or delivered:
            counted += 1
            hits += delivered

    done_with_deadline = [t for t in my_tasks if t.status == "done" and t.deadline and t.done_at]
    on_time = sum(1 for t in done_with_deadline if t.done_at.date() <= t.deadline)
    late_open = sum(1 for t in my_tasks if t.status != "done" and t.deadline and t.deadline < today)
    graded = len(done_with_deadline) + late_open

    metrics = {
        "contribution": round(sum(contrib_scores) / len(contrib_scores)) if contrib_scores else None,
        "consistency": round(100 * hits / counted) if counted else None,
        "on_time": round(100 * on_time / graded) if graded else None,
    }
    known = [v for v in metrics.values() if v is not None]
    metrics["overall"] = round(sum(known) / len(known)) if known else None

    # weekly activity: points finished per week, last 12 weeks (weeks start Monday)
    start = today - timedelta(days=today.weekday()) - timedelta(weeks=11)
    weeks = [start + timedelta(weeks=i) for i in range(12)]
    weekly = [{"week": w.strftime("%b %d").replace(" 0", " "), "points": 0} for w in weeks]
    for t in my_tasks:
        if t.status == "done" and t.done_at and t.done_at.date() >= start:
            weekly[min(11, (t.done_at.date() - start).days // 7)]["points"] += t.points

    return {
        "projects": rows,
        "metrics": metrics,
        "weekly": weekly,
        "totals": {"points_done": sum(r["points_done"] for r in rows), "tasks_done": sum(r["tasks_done"] for r in rows),
                   "projects": len(rows), "open_tasks": sum(1 for t in my_tasks if t.status != "done")},
    }


def members_of_project(db: Session, pid: int) -> list[Member]:
    return db.exec(select(Member).where(Member.project_id == pid)).all()
