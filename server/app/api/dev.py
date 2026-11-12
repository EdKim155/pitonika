"""Только для разработки и e2e: сброс локального прогресса.

Доступен лишь при PITONIKA_DEV=1 — в обычном запуске возвращает 404.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.db.models import (
    AchievementUnlock,
    Attempt,
    ChatMessage,
    ConceptState,
    DailyStat,
    EventLog,
    GeneratedTask,
    LessonProgress,
    Profile,
    ReviewLog,
    Setting,
    Snippet,
    StepProgress,
)
from app.db.migrations import _bootstrap_profile, _bootstrap_settings
from app.db.session import get_session

router = APIRouter(prefix="/api/dev", tags=["dev"])

MODELS = [
    AchievementUnlock,
    Attempt,
    ChatMessage,
    ConceptState,
    DailyStat,
    EventLog,
    GeneratedTask,
    LessonProgress,
    ReviewLog,
    Setting,
    Snippet,
    StepProgress,
    Profile,
]


@router.post("/reset")
def reset(session: Session = Depends(get_session)) -> dict:
    if os.environ.get("PITONIKA_DEV") != "1":
        raise HTTPException(status_code=404, detail="Not found")
    for model in MODELS:
        session.execute(delete(model))
    session.commit()
    _bootstrap_profile(session)
    _bootstrap_settings(session)
    session.commit()
    return {"ok": True}
