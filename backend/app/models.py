from datetime import date, datetime
from typing import Optional

from sqlalchemy import Column, JSON
from sqlmodel import Field, Session, SQLModel, create_engine

engine = create_engine("sqlite:///crewgrid.db", connect_args={"check_same_thread": False})


def now():
    return datetime.utcnow()


class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(index=True, unique=True)
    role: str = "student"  # student | faculty
    password_hash: str
    bio: str = ""
    skills: list = Field(default_factory=list, sa_column=Column(JSON))  # [{name, level}]


class Project(SQLModel, table=True):
    __tablename__ = "projects"
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    description: str = ""
    required_skills: list = Field(default_factory=list, sa_column=Column(JSON))
    team_size: int = 5
    start_date: date
    end_date: date
    sprint_days: int = 14
    lead_id: int
    status: str = "recruiting"  # recruiting | active


class Member(SQLModel, table=True):
    __tablename__ = "members"
    project_id: int = Field(primary_key=True)
    user_id: int = Field(primary_key=True)
    role: str = "member"  # lead | member


class JoinRequest(SQLModel, table=True):
    __tablename__ = "join_requests"
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int
    user_id: int
    message: str = ""
    status: str = "pending"  # pending | accepted | rejected


class Sprint(SQLModel, table=True):
    __tablename__ = "sprints"
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int
    number: int
    start: date
    end: date
    name: str = ""
    goal: str = ""
    alerted: bool = False


class Task(SQLModel, table=True):
    __tablename__ = "tasks"
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int
    sprint_id: Optional[int] = None
    title: str
    description: str = ""
    phase: int = 1
    priority: str = "medium"
    points: int = 3
    assignee_id: Optional[int] = None
    status: str = "todo"  # todo | in_progress | done
    deadline: Optional[date] = None
    done_at: Optional[datetime] = None


class Message(SQLModel, table=True):
    __tablename__ = "messages"
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int
    user_id: Optional[int] = None  # None = CrewGrid AI
    body: str
    created_at: datetime = Field(default_factory=now)


class Notification(SQLModel, table=True):
    __tablename__ = "notifications"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int
    text: str
    link: str = ""
    read: bool = False
    created_at: datetime = Field(default_factory=now)


class Summary(SQLModel, table=True):
    __tablename__ = "summaries"
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int
    data: dict = Field(default_factory=dict, sa_column=Column("json", JSON))
    created_at: datetime = Field(default_factory=now)


# create_all never alters existing tables, so add columns introduced after the first release by hand
NEW_COLUMNS = {"sprints": {"name": "VARCHAR DEFAULT ''", "goal": "VARCHAR DEFAULT ''"}}


def init_db():
    SQLModel.metadata.create_all(engine)
    with engine.begin() as conn:
        for table, cols in NEW_COLUMNS.items():
            have = {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}
            for col, ddl in cols.items():
                if col not in have:
                    conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}")


def get_session():
    with Session(engine) as session:
        yield session
