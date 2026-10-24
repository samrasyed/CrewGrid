import os
from datetime import datetime, timedelta

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from .models import Member, Project, User, get_session

load_dotenv()
SECRET = os.getenv("JWT_SECRET", "crewgrid-dev-secret")
FACULTY_CODE = os.getenv("FACULTY_CODE", "FACULTY2026")
bearer = HTTPBearer(auto_error=False)


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())


def make_token(user: User) -> str:
    payload = {"sub": str(user.id), "role": user.role, "exp": datetime.utcnow() + timedelta(hours=24)}
    return jwt.encode(payload, SECRET, algorithm="HS256")


def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_session)) -> User:
    if not creds:
        raise HTTPException(401, "Not logged in")
    try:
        data = jwt.decode(creds.credentials, SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
    user = db.get(User, int(data["sub"]))
    if not user:
        raise HTTPException(401, "User not found")
    return user


def project_role(db: Session, user: User, project_id: int) -> str | None:
    """Returns 'faculty', 'lead', 'member' or None."""
    if user.role == "faculty":
        return "faculty"
    m = db.get(Member, (project_id, user.id))
    return m.role if m else None


def require(db: Session, user: User, project_id: int, *allowed: str) -> str:
    """Single permission helper. allowed is a subset of faculty/lead/member."""
    if not db.get(Project, project_id):
        raise HTTPException(404, "Project not found")
    role = project_role(db, user, project_id)
    if role not in allowed:
        raise HTTPException(403, "You don't have permission for this action")
    return role
