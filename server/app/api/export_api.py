"""Экспорт и импорт локального прогресса."""
from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, inspect as sa_inspect
from sqlalchemy.orm import Session

from app.db.models import (
    AchievementUnlock,
    Attempt,
    Base,
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
from app.db.session import get_session

router = APIRouter(prefix="/api", tags=["export"])

MODELS = [
    Profile,
    Setting,
    StepProgress,
    LessonProgress,
    Attempt,
    ConceptState,
    ReviewLog,
    DailyStat,
    AchievementUnlock,
    EventLog,
    ChatMessage,
    GeneratedTask,
    Snippet,
]


def _serialize_row(row) -> dict:  # noqa: ANN001
    data = {}
    for column in sa_inspect(row).mapper.column_attrs:
        value = getattr(row, column.key)
        if isinstance(value, (datetime, date)):
            value = value.isoformat()
        data[column.key] = value
    return data


def _decode_row(model, data: dict) -> dict:  # noqa: ANN001
    prepared = {}
    for column in sa_inspect(model).mapper.column_attrs:
        if column.key not in data:
            continue
        value = data[column.key]
        python_type = column.columns[0].type.python_type
        if python_type is datetime and isinstance(value, str):
            value = datetime.fromisoformat(value)
        elif python_type is date and isinstance(value, str):
            value = date.fromisoformat(value)
        prepared[column.key] = value
    return prepared


@router.get("/export")
def export_data(session: Session = Depends(get_session)) -> dict:
    payload = {"version": 1, "tables": {}}
    for model in MODELS:
        rows = session.query(model).all()
        payload["tables"][model.__tablename__] = [_serialize_row(row) for row in rows]
    return payload


@router.post("/import")
def import_data(payload: dict, session: Session = Depends(get_session)) -> dict:
    tables = payload.get("tables")
    if not isinstance(tables, dict):
        raise HTTPException(status_code=400, detail="Неверный формат файла")
    try:
        for model in reversed(MODELS):
            session.execute(delete(model))
        for model in MODELS:
            rows = tables.get(model.__tablename__) or []
            for item in rows:
                session.add(model(**_decode_row(model, item)))
        session.commit()
    except Exception as exc:  # noqa: BLE001
        session.rollback()
        raise HTTPException(status_code=400, detail=f"Не удалось импортировать: {exc}") from exc
    return {"ok": True}


@router.get("/snippets")
def list_snippets(session: Session = Depends(get_session)) -> dict:
    rows = session.query(Snippet).order_by(Snippet.updated_at.desc()).all()
    return {"snippets": [{"id": r.id, "title": r.title, "code": r.code, "updatedAt": r.updated_at.isoformat()} for r in rows]}


@router.post("/snippets")
def create_snippet(payload: dict, session: Session = Depends(get_session)) -> dict:
    snippet = Snippet(title=str(payload.get("title") or "Без названия")[:120], code=str(payload.get("code") or ""))
    session.add(snippet)
    session.commit()
    return {"id": snippet.id, "title": snippet.title, "code": snippet.code}


@router.delete("/snippets/{snippet_id}")
def delete_snippet(snippet_id: int, session: Session = Depends(get_session)) -> dict:
    snippet = session.get(Snippet, snippet_id)
    if snippet is None:
        raise HTTPException(status_code=404, detail="Сниппет не найден")
    session.delete(snippet)
    session.commit()
    return {"ok": True}
