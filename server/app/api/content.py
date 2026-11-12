"""Выдача контента и шагов."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.content import get_content
from app.db.session import get_session
from app.services.learning import build_path, lesson_view

router = APIRouter(prefix="/api/content", tags=["content"])


@router.get("/path")
def path(session: Session = Depends(get_session)) -> dict:
    return {"modules": build_path(session, get_content())}


@router.get("/lesson/{lesson_id}")
def lesson(lesson_id: str, session: Session = Depends(get_session)) -> dict:
    payload = lesson_view(session, get_content(), lesson_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Урок не найден")
    return payload
