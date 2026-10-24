"""Reset the database and load demo data: python -m app.seed"""
import os
from datetime import date, datetime, timedelta

from sqlmodel import Session, SQLModel, select

from .ai import mock_plan
from .auth import hash_password
from .logic import split_tasks, sprint_ranges
from .models import JoinRequest, Member, Message, Project, Sprint, Task, User, engine

PW = "demo123"


def make_project(db, title, desc, skills, lead, members, start, end, days=14, status="active"):
    p = Project(title=title, description=desc, required_skills=skills, team_size=5, start_date=start,
                end_date=end, sprint_days=days, lead_id=lead.id, status=status)
    db.add(p)
    db.commit()
    db.refresh(p)
    db.add(Member(project_id=p.id, user_id=lead.id, role="lead"))
    for m in members:
        db.add(Member(project_id=p.id, user_id=m.id, role="member"))
    db.commit()
    return p


def make_plan(db, p, team):
    ranges = sprint_ranges(p.start_date, p.end_date, p.sprint_days)
    plan = mock_plan(p.title, p.required_skills, len(ranges))
    sprints = []
    for i, (s, e) in enumerate(ranges):
        meta = plan["sprints"][i]
        sp = Sprint(project_id=p.id, number=i + 1, start=s, end=e, name=meta["name"], goal=meta["goal"])
        db.add(sp)
        sprints.append(sp)
    db.commit()
    members = [{"id": u.id, "skills": {s["name"].lower() for s in u.skills}} for u in team]
    tasks = []
    for t in split_tasks(plan["tasks"], members, len(sprints)):
        sp = sprints[t["sprint_index"]]
        task = Task(project_id=p.id, sprint_id=sp.id, title=t["title"], description=t["description"], phase=t["phase"],
                    priority=t["priority"], points=t["points"], assignee_id=t["assignee_id"], deadline=sp.end)
        db.add(task)
        tasks.append(task)
    db.commit()
    return sprints, tasks


def run():
    if os.path.exists("crewgrid.db"):
        SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    today = date.today()
    with Session(engine) as db:
        fac = User(name="Dr. Priya Rao", email="faculty@crewgrid.dev", role="faculty", password_hash=hash_password(PW),
                   bio="Course coordinator, Software Engineering Lab",
                   skills=[{"name": "Software Engineering", "level": 5}, {"name": "Agile", "level": 4}, {"name": "Databases", "level": 4}])
        people = [
            ("Alice Chen", "alice", [("React", 5), ("JavaScript", 4), ("UI Design", 3)], "Frontend person who loves clean UIs."),
            ("Bob Kumar", "bob", [("Python", 5), ("FastAPI", 4), ("SQL", 4)], "Backend and databases."),
            ("Carol Diaz", "carol", [("UI Design", 5), ("Figma", 4), ("React", 2)], "Designer learning to code."),
            ("Dave Okafor", "dave", [("Python", 4), ("Machine Learning", 4), ("Data Analysis", 3)], "ML enthusiast."),
            ("Erin Park", "erin", [("Node.js", 4), ("JavaScript", 4), ("Testing", 3)], "Full-stack, test-first."),
            ("Frank Silva", "frank", [("Java", 4), ("SQL", 3), ("Testing", 4)], "QA and backend."),
        ]
        users = [fac] + [User(name=n, email=f"{e}@crewgrid.dev", role="student", password_hash=hash_password(PW), bio=b,
                              skills=[{"name": s, "level": l} for s, l in sk]) for n, e, sk, b in people]
        db.add_all(users)
        db.commit()
        for u in users:
            db.refresh(u)
        alice, bob, carol, dave, erin, frank = users[1:]

        # 1. healthy project, in sprint 1, good progress
        p1 = make_project(db, "Campus Food Finder", "A web app that shows open food spots on campus with live menus and ratings.",
                          ["React", "Python", "UI Design"], alice, [bob, carol], today - timedelta(days=10), today + timedelta(days=46))
        sp1, t1 = make_plan(db, p1, [alice, bob, carol])
        for t in t1:
            if t.sprint_id == sp1[0].id:
                t.status = "done" if t.priority == "high" else "in_progress"
                if t.status == "done":
                    t.done_at = datetime.utcnow()
                db.add(t)

        # 2. project with an overdue sprint (sprint 1 ended a week ago with unfinished work)
        p2 = make_project(db, "Study Buddy Matcher", "Matches students into study groups using course and schedule data.",
                          ["Python", "Machine Learning", "Testing"], dave, [erin, frank], today - timedelta(days=21), today + timedelta(days=35))
        sp2, t2 = make_plan(db, p2, [dave, erin, frank])
        first = [t for t in t2 if t.sprint_id == sp2[0].id]
        for i, t in enumerate(first):
            if i % 2 == 0:
                t.status, t.done_at = "done", datetime.utcnow() - timedelta(days=9)
            db.add(t)

        # 3. recruiting project with 2 pending requests
        p3 = make_project(db, "Green Campus Tracker", "Track and gamify recycling and energy saving across dorms.",
                          ["React", "Node.js", "Data Analysis"], erin, [], today + timedelta(days=3), today + timedelta(days=59),
                          status="recruiting")
        db.add(JoinRequest(project_id=p3.id, user_id=alice.id, message="I can own the React dashboard!"))
        db.add(JoinRequest(project_id=p3.id, user_id=dave.id, message="Happy to do the data analysis part."))

        # chat
        base = datetime.utcnow() - timedelta(hours=3)
        chat = [
            (p2.id, dave.id, "Morning team, how are we doing on the data model?"),
            (p2.id, erin.id, "I'm stuck on the tests, will push tonight."),
            (p2.id, fac.id, "Reminder: sprint 1 deadline has passed, please update the board."),
            (p2.id, None, "Sprint 1 still has unfinished tasks. Erin and Frank, focus on those before starting sprint 2."),
            (p1.id, alice.id, "Wireframes are done, check Figma!"),
            (p1.id, bob.id, "API skeleton is up on the dev branch."),
        ]
        for i, (pid, uid, body) in enumerate(chat):
            db.add(Message(project_id=pid, user_id=uid, body=body, created_at=base + timedelta(minutes=10 * i)))
        db.commit()

    print("\nCrewGrid demo data loaded. All passwords: demo123")
    print("  Faculty : faculty@crewgrid.dev")
    for _, e, _, _ in people:
        print(f"  Student : {e}@crewgrid.dev")
    print("  (alice leads Campus Food Finder, dave leads Study Buddy Matcher, erin leads Green Campus Tracker)")
    print("  Log in as faculty and click 'Run checks now' to fire the overdue alert.\n")


if __name__ == "__main__":
    run()
