import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from .logic import check_overdue
from .models import engine, init_db
from .routes import router


async def overdue_loop():
    while True:
        await asyncio.sleep(60)  # first check after 60s so the demo button has something to fire
        try:
            with Session(engine) as db:
                check_overdue(db)
        except Exception as e:  # keep the loop alive
            print("overdue loop error:", e)


@asynccontextmanager
async def lifespan(app):
    init_db()
    task = asyncio.create_task(overdue_loop())
    yield
    task.cancel()


app = FastAPI(title="CrewGrid", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(router)
