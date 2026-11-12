"""Запуск кода и проверка шагов."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.schemas import CompleteStepRequest, GradeRequest
from app.content import get_content
from app.db.session import get_session
from app.runner.sandbox import resolve_interpreter
from app.services.grading import grade_step
from app.services.learning import complete_lesson, reveal_solution, record_step_result
from app.services.progress import get_profile
from app.services.settings_store import get_settings

router = APIRouter(prefix="/api", tags=["grading"])

QUIZ_TYPES = {"quiz", "predict", "blank", "parsons", "open"}


def _load_step(step_id: str):
    index = get_content()
    step = index.steps.get(step_id)
    if step is None:
        raise HTTPException(status_code=404, detail="Шаг не найден")
    lesson = index.lessons[index.step_lesson[step_id]]
    return index, step, lesson


@router.post("/grade")
async def grade(payload: GradeRequest, session: Session = Depends(get_session)) -> dict:
    index, step, lesson = _load_step(payload.stepId)
    settings = get_settings(session)
    interpreter = resolve_interpreter(settings.get("python_path"))
    timeout_seconds = int(settings.get("timeout_seconds") or 5)

    grade_payload = {
        "code": payload.code,
        "stdin": payload.stdin,
        "answers": payload.answers,
        "answer": payload.answer,
        "order": payload.order,
        "text": payload.text,
    }
    graded = await grade_step(
        step, grade_payload, interpreter, timeout_seconds, docker=bool(settings.get("strict_mode"))
    )
    result = record_step_result(
        session,
        index,
        lesson,
        step,
        graded,
        hints_used=max(0, min(3, payload.hintsUsed)),
        revealed=payload.revealed,
        duration_ms=max(0, min(120000, payload.durationMs)),
        payload_code=payload.code or "",
        payload_stdin=payload.stdin or "",
    )
    result["stepId"] = step.id
    result["stepType"] = step.type
    if step.type == "quiz":
        result["correctAnswers"] = step.answers
    if step.type == "predict":
        result["correctAnswers"] = [step.answer]
    if step.type == "blank":
        result["correctAnswers"] = [blank.answer for blank in step.blanks]
    if step.type == "parsons":
        result["correctAnswers"] = step.solution
    return result


@router.post("/step/complete")
def complete_step(payload: CompleteStepRequest, session: Session = Depends(get_session)) -> dict:
    index, step, lesson = _load_step(payload.stepId)
    if step.type not in ("theory", "open"):
        raise HTTPException(status_code=400, detail="Этот шаг проверяется через /api/grade")
    from app.services.grading import GradeResult

    graded = GradeResult(True, {"kind": step.type})
    result = record_step_result(
        session,
        index,
        lesson,
        step,
        graded,
        hints_used=0,
        revealed=False,
        duration_ms=max(0, min(120000, payload.durationMs)),
    )
    result["stepId"] = step.id
    result["stepType"] = step.type
    return result


@router.post("/lesson/{lesson_id}/complete")
def finish_lesson(lesson_id: str, session: Session = Depends(get_session)) -> dict:
    result = complete_lesson(session, get_content(), lesson_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Урок не найден")
    return result


@router.post("/step/{step_id}/reveal")
def reveal(step_id: str, session: Session = Depends(get_session)) -> dict:
    _, step, lesson = _load_step(step_id)
    solution = reveal_solution(session, lesson, step)
    if solution is None:
        raise HTTPException(status_code=404, detail="Для этого шага нет решения")
    return {"solution": solution}


@router.get("/lesson/{lesson_id}/solution/{step_id}")
def solution(lesson_id: str, step_id: str, session: Session = Depends(get_session)) -> dict:
    _, step, lesson = _load_step(step_id)
    if lesson.id != lesson_id:
        raise HTTPException(status_code=404, detail="Шаг не из этого урока")
    value = getattr(step, "solution", None)
    if not value:
        raise HTTPException(status_code=404, detail="Для этого шага нет решения")
    return {"solution": value}
