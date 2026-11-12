"""Подсказки для тренировки: что повторить и какой шаг открыть."""
from __future__ import annotations

import random

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.content import get_content
from app.db.models import ConceptState, LessonProgress, StepProgress
from app.db.session import get_session

router = APIRouter(prefix="/api/practice", tags=["practice"])


@router.get("/suggestions")
def suggestions(session: Session = Depends(get_session), limit: int = 6) -> dict:
    index = get_content()
    states = {row.concept_id: row for row in session.query(ConceptState).all()}
    done_lessons = {
        row.lesson_id for row in session.query(LessonProgress).where(LessonProgress.status == "done").all()
    }
    done_steps = {row.step_id for row in session.query(StepProgress).where(StepProgress.status == "done").all()}

    candidates: list[dict] = []
    for lesson_id in index.lesson_order:
        lesson = index.lessons[lesson_id]
        if lesson.id not in done_lessons:
            continue
        for step in lesson.steps:
            if step.type not in ("code", "debug", "quiz", "predict", "blank", "parsons"):
                continue
            concepts = step.concepts or lesson.concepts
            if not concepts:
                continue
            mastery = min((states[c].mastery if c in states else 0.0) for c in concepts)
            if mastery >= 0.85 and step.id in done_steps:
                continue
            candidates.append(
                {
                    "stepId": step.id,
                    "lessonId": lesson.id,
                    "lessonTitle": lesson.title,
                    "type": step.type,
                    "conceptIds": concepts,
                    "conceptTitle": index.concepts[concepts[0]].title if concepts[0] in index.concepts else "",
                    "mastery": round(mastery, 2),
                }
            )

    candidates.sort(key=lambda item: item["mastery"])
    random.shuffle(candidates)
    candidates.sort(key=lambda item: item["mastery"])
    seen: set[str] = set()
    result = []
    for item in candidates:
        key = item["lessonId"]
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
        if len(result) >= max(1, min(12, limit)):
            break
    return {"suggestions": result}
