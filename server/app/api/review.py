"""Интервальное повторение концептов."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.schemas import ReviewAnswerRequest
from app.content import get_content
from app.db.models import ConceptState, ReviewLog, utcnow
from app.db.session import get_session
from app.services.learning import _apply_activity
from app.services.progress import get_profile, update_srs
from app.services.learning import serialize_step

router = APIRouter(prefix="/api/review", tags=["review"])


def _pick_step(concept_id: str) -> tuple[dict[str, Any] | None, str | None, list[Any] | None]:
    index = get_content()
    for lesson_id in index.lesson_order:
        lesson = index.lessons[lesson_id]
        for step in lesson.steps:
            concepts = step.concepts or lesson.concepts
            if concept_id in concepts and step.type in ("quiz", "predict", "blank"):
                payload = serialize_step(step)
                answers: list[Any] | None = None
                if step.type == "quiz":
                    answers = list(step.answers)
                elif step.type == "predict":
                    answers = [step.answer]
                elif step.type == "blank":
                    answers = [blank.answer for blank in step.blanks]
                return payload, lesson_id, answers
    return None, None, None


@router.get("/queue")
def queue(session: Session = Depends(get_session), limit: int = 10) -> dict:
    index = get_content()
    now = utcnow()
    total_due = (
        session.query(ConceptState)
        .filter(ConceptState.srs_due.isnot(None), ConceptState.srs_due <= now, ConceptState.attempts > 0)
        .count()
    )
    rows = (
        session.query(ConceptState)
        .filter(ConceptState.srs_due.isnot(None), ConceptState.srs_due <= now, ConceptState.attempts > 0)
        .order_by(ConceptState.srs_due)
        .limit(max(1, min(30, limit)))
        .all()
    )
    cards = []
    for state in rows:
        concept = index.concepts.get(state.concept_id)
        if concept is None:
            continue
        step_payload, lesson_id, answers = _pick_step(state.concept_id)
        cards.append(
            {
                "conceptId": state.concept_id,
                "conceptTitle": concept.title,
                "conceptDescription": concept.description,
                "lessonId": lesson_id,
                "step": step_payload,
                "correctAnswers": answers,
                "dueAt": state.srs_due.isoformat() if state.srs_due else None,
                "interval": state.srs_interval,
            }
        )
    return {"cards": cards, "due": total_due}


@router.post("/answer")
def answer(payload: ReviewAnswerRequest, session: Session = Depends(get_session)) -> dict:
    state = session.get(ConceptState, payload.conceptId)
    if state is None:
        raise HTTPException(status_code=404, detail="Концепт ещё не изучался")
    update_srs(state, payload.correct)
    session.add(ReviewLog(concept_id=payload.conceptId, rating=1 if payload.correct else 0, due_at=state.srs_due))
    profile = get_profile(session)
    xp = 2 if payload.correct else 0
    if xp:
        profile.xp += xp
    _apply_activity(session, profile, xp, minutes=0)
    session.commit()
    return {
        "ok": True,
        "xpGained": xp,
        "nextInterval": state.srs_interval,
        "nextDue": state.srs_due.isoformat() if state.srs_due else None,
    }
