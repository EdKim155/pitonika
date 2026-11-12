"""Сборка учебного пути, выдача шагов и фиксация прогресса."""
from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.content.loader import ContentIndex
from app.content.schema import Lesson, Step
from app.db.models import (
    Attempt,
    ConceptState,
    DailyStat,
    LessonProgress,
    Profile,
    ReviewLog,
    StepProgress,
    utcnow,
)
from app.services.grading import GradeResult
from app.services.progress import (
    _apply_activity,
    check_achievements,
    effective_score,
    get_profile,
    level_progress,
    list_achievements,
    local_today,
    log_event,
    stats_snapshot,
    update_mastery,
    update_srs,
)


def serialize_step(step: Step) -> dict[str, Any]:
    base: dict[str, Any] = {"id": step.id, "type": step.type, "title": step.title, "concepts": step.concepts}
    if step.type == "theory":
        base.update(body=step.body, example=step.example, aside=step.aside)
    elif step.type == "quiz":
        base.update(question=step.question, options=step.options, multiple=step.multiple, code=step.code)
    elif step.type == "predict":
        base.update(code=step.code, options=step.options)
    elif step.type == "blank":
        base.update(
            prompt=step.prompt,
            template=step.template,
            blanks=[{"hint": b.hint} for b in step.blanks],
        )
    elif step.type == "parsons":
        base.update(prompt=step.prompt, lines=step.lines)
    elif step.type in ("code", "debug"):
        base.update(
            prompt=step.prompt,
            mode=step.mode,
            starter=step.starter if step.type == "code" else step.broken,
            fixtures=[{"stdin": f.stdin, "stdout": f.stdout} for f in step.fixtures],
            hints=step.hints,
            testCount=len(step.tests),
            signature=step.signature if step.type == "code" else None,
        )
    elif step.type == "open":
        base.update(prompt=step.prompt, rubric=step.rubric, minWords=step.min_words)
    return base


def _lesson_status(
    global_index: int,
    lesson_id: str,
    profile: Profile,
    progress: dict[str, LessonProgress],
    current_index: int | None,
) -> str:
    record = progress.get(lesson_id)
    done = bool(record and record.status == "done")
    if done:
        return "done"
    if global_index > profile.unlocked_index:
        return "locked"
    if current_index is not None and global_index == current_index:
        return "current"
    return "available"


def build_path(session: Session, index: ContentIndex) -> list[dict[str, Any]]:
    profile = get_profile(session)
    progress = {row.lesson_id: row for row in session.query(LessonProgress).all()}
    modules: list[dict[str, Any]] = []
    global_index = 0
    current_index: int | None = profile.unlocked_index

    for module in index.modules:
        lessons = index.module_lessons(module.id)
        items = []
        done_count = 0
        for lesson in lessons:
            status = _lesson_status(global_index, lesson.id, profile, progress, current_index)
            if status == "done":
                done_count += 1
            record = progress.get(lesson.id)
            items.append(
                {
                    "id": lesson.id,
                    "title": lesson.title,
                    "goal": lesson.goal,
                    "minutes": lesson.minutes,
                    "order": lesson.order,
                    "steps": len(lesson.steps),
                    "status": status,
                    "score": round(record.best_score, 2) if record else 0,
                    "index": global_index,
                }
            )
            global_index += 1
        modules.append(
            {
                "id": module.id,
                "title": module.title,
                "subtitle": module.subtitle,
                "number": module.number,
                "color": module.color,
                "icon": module.icon,
                "description": module.description,
                "lessons": items,
                "total": len(lessons),
                "done": done_count,
                "progress": round(done_count / len(lessons), 3) if lessons else 0,
            }
        )
    return modules


def lesson_view(session: Session, index: ContentIndex, lesson_id: str) -> dict[str, Any] | None:
    lesson = index.lessons.get(lesson_id)
    if lesson is None:
        return None
    profile = get_profile(session)
    progress = {row.step_id: row for row in session.query(StepProgress).where(StepProgress.lesson_id == lesson_id)}
    steps = []
    for step in lesson.steps:
        item = serialize_step(step)
        record = progress.get(step.id)
        item["state"] = {
            "status": record.status if record else "pending",
            "score": round(record.score, 2) if record else 0,
            "attempts": record.attempts if record else 0,
            "hintsUsed": record.hints_used if record else 0,
        }
        steps.append(item)
    module = next((m for m in index.modules if m.id == lesson.module), None)
    return {
        "id": lesson.id,
        "module": {"id": module.id, "title": module.title, "color": module.color} if module else None,
        "title": lesson.title,
        "goal": lesson.goal,
        "minutes": lesson.minutes,
        "concepts": lesson.concepts,
        "steps": steps,
        "streak": profile.streak_current,
    }


def _concepts_for(step: Step, lesson: Lesson) -> list[str]:
    return step.concepts or lesson.concepts


def record_step_result(
    session: Session,
    index: ContentIndex,
    lesson: Lesson,
    step: Step,
    graded: GradeResult,
    hints_used: int,
    revealed: bool,
    duration_ms: int,
    payload_code: str = "",
    payload_stdin: str = "",
    detail_override: dict[str, Any] | None = None,
) -> dict[str, Any]:
    profile = get_profile(session)
    record = session.get(StepProgress, step.id)
    if record is None:
        record = StepProgress(step_id=step.id, lesson_id=lesson.id)
        session.add(record)
        session.flush()

    attempts_before = record.attempts
    record.attempts += 1
    record.hints_used = max(record.hints_used, hints_used)
    record.revealed = record.revealed or revealed
    record.updated_at = utcnow()

    xp_gain = 0
    newly_done = False
    score = 0.0
    if graded.passed:
        score = effective_score(attempts_before, record.hints_used, record.revealed)
        record.score = max(record.score, score)
        if record.status != "done":
            record.status = "done"
            newly_done = True
            if step.type == "theory":
                xp_gain = 5
            else:
                xp_gain = round(10 * score)
    else:
        record.score = max(record.score, 0.0)

    details = detail_override if detail_override is not None else graded.details
    attempt = Attempt(
        step_id=step.id,
        kind=step.type if step.type in ("code", "debug") else "quiz",
        code=payload_code,
        stdin=payload_stdin,
        stdout=str(details.get("stdout") or "")[:20000],
        stderr=str(details.get("stderr") or "")[:20000],
        tests_json=json.dumps(details.get("tests") or details.get("cases") or [], ensure_ascii=False)[:40000],
        passed=graded.passed,
        score=score,
        duration_ms=duration_ms,
    )
    session.add(attempt)

    if graded.passed:
        for concept_id in _concepts_for(step, lesson):
            if concept_id not in index.concepts:
                continue
            cs = session.get(ConceptState, concept_id)
            if cs is None:
                cs = ConceptState(concept_id=concept_id)
                session.add(cs)
                session.flush()
            update_mastery(cs, score)
            update_srs(cs, True)
            cs.last_at = utcnow()
    elif hints_used == 0:
        # неудачная попытка снижает уверенность, но не наказывает за подсказки
        for concept_id in _concepts_for(step, lesson):
            cs = session.get(ConceptState, concept_id)
            if cs is not None:
                update_srs(cs, False)

    daily = None
    if newly_done:
        profile.xp += xp_gain
        profile.level = level_progress(profile.xp)["level"]
        daily = _apply_activity(
            session, profile, xp_gain, steps=1, minutes=max(0, min(10, duration_ms // 60000))
        )
        log_event(session, "step_done", {"step": step.id, "score": score, "xp": xp_gain})

    session.flush()
    stats = stats_snapshot(session, profile, 0)
    stats["modules_done"] = _modules_done(session, index)
    fresh = check_achievements(session, profile, stats)
    session.commit()

    return {
        "passed": graded.passed,
        "score": round(record.score, 2),
        "firstTry": graded.passed and attempts_before == 0 and record.hints_used == 0,
        "xpGained": xp_gain,
        "newlyDone": newly_done,
        "details": details,
        "explanation": step.explanation if hasattr(step, "explanation") else None,
        "level": level_progress(profile.xp),
        "streak": {
            "current": profile.streak_current,
            "best": profile.streak_best,
            "freezes": profile.freeze_tokens,
        },
        "daily": {
            "xp": daily.xp if daily else profile.xp,
            "goalMet": daily.goal_met if daily else False,
            "goalXp": _goal_xp(session),
        },
        "achievements": fresh,
    }


def _goal_xp(session: Session) -> int:
    from app.services.settings_store import get_settings

    return int(get_settings(session).get("daily_goal_xp") or 40)


def _modules_done(session: Session, index: ContentIndex) -> int:
    done_ids = {
        row.lesson_id
        for row in session.query(LessonProgress).where(LessonProgress.status == "done").all()
    }
    count = 0
    for module in index.modules:
        lessons = [lesson.id for lesson in index.module_lessons(module.id)]
        if lessons and all(lid in done_ids for lid in lessons):
            count += 1
    return count


def complete_lesson(session: Session, index: ContentIndex, lesson_id: str) -> dict[str, Any] | None:
    lesson = index.lessons.get(lesson_id)
    if lesson is None:
        return None
    profile = get_profile(session)
    record = session.get(LessonProgress, lesson_id)
    if record is None:
        record = LessonProgress(lesson_id=lesson_id)
        session.add(record)
        session.flush()

    first_time = record.status != "done"
    xp_gain = 0
    if first_time:
        record.status = "done"
        record.completed_at = utcnow()
        position = index.lesson_order.index(lesson_id)
        profile.unlocked_index = max(profile.unlocked_index, position + 1)
        xp_gain = 25
        profile.xp += xp_gain
        profile.level = level_progress(profile.xp)["level"]
        _apply_activity(session, profile, xp_gain, lessons=1, minutes=lesson.minutes, force_qualify=True)
        log_event(session, "lesson_done", {"lesson": lesson_id, "xp": xp_gain})

    scores = [
        row.score
        for row in session.query(StepProgress).where(StepProgress.lesson_id == lesson_id, StepProgress.status == "done").all()
    ]
    if scores:
        record.best_score = max(record.best_score, sum(scores) / len(scores))

    session.flush()
    stats = stats_snapshot(session, profile, 0)
    stats["modules_done"] = _modules_done(session, index)
    fresh = check_achievements(session, profile, stats)
    session.commit()

    return {
        "lessonId": lesson_id,
        "firstTime": first_time,
        "xpGained": xp_gain,
        "level": level_progress(profile.xp),
        "streak": {
            "current": profile.streak_current,
            "best": profile.streak_best,
            "freezes": profile.freeze_tokens,
        },
        "daily": {"xp": _today_xp(session, profile), "goalMet": _today_goal(session, profile), "goalXp": _goal_xp(session)},
        "achievements": fresh,
    }


def _today_xp(session: Session, profile: Profile) -> int:
    stat = session.get(DailyStat, local_today(profile))
    return stat.xp if stat else 0


def _today_goal(session: Session, profile: Profile) -> bool:
    stat = session.get(DailyStat, local_today(profile))
    return bool(stat and stat.goal_met)


def reveal_solution(session: Session, lesson: Lesson, step: Step) -> str | None:
    solution = getattr(step, "solution", None)
    if not solution:
        return None
    record = session.get(StepProgress, step.id)
    if record is not None:
        record.revealed = True
        record.updated_at = utcnow()
        session.commit()
    return solution


def progress_summary(session: Session, index: ContentIndex) -> dict[str, Any]:
    profile = get_profile(session)
    today = local_today(profile)
    start = today - timedelta(days=83)
    daily_rows = (
        session.query(DailyStat).filter(DailyStat.date >= start).order_by(DailyStat.date).all()
    )
    by_date = {row.date: row for row in daily_rows}
    heatmap = []
    for offset in range(84):
        day = start + timedelta(days=offset)
        row = by_date.get(day)
        heatmap.append(
            {
                "date": day.isoformat(),
                "xp": row.xp if row else 0,
                "minutes": row.minutes if row else 0,
                "qualifies": bool(row.qualifies) if row else False,
            }
        )

    total_steps = session.scalar(select(func.count()).select_from(StepProgress).where(StepProgress.status == "done")) or 0
    total_lessons = session.scalar(select(func.count()).select_from(LessonProgress).where(LessonProgress.status == "done")) or 0
    total_attempts = session.scalar(select(func.count()).select_from(Attempt)) or 0
    passed_attempts = session.scalar(select(func.count()).select_from(Attempt).where(Attempt.passed.is_(True))) or 0
    total_minutes = session.scalar(select(func.coalesce(func.sum(DailyStat.minutes), 0))) or 0

    kind_rows = session.execute(
        select(Attempt.kind, func.count(), func.sum(func.iif(Attempt.passed, 1, 0))).group_by(Attempt.kind)
    ).all()
    accuracy_by_kind = [
        {"kind": kind, "total": total, "passed": int(passed or 0), "accuracy": round((passed or 0) / total, 2) if total else 0}
        for kind, total, passed in kind_rows
    ]

    concepts = []
    for cs in session.query(ConceptState).all():
        concept = index.concepts.get(cs.concept_id)
        if concept is None:
            continue
        mastery = cs.mastery
        if cs.last_at:
            days = max(0, (utcnow() - cs.last_at).days)
            if days > 7:
                mastery *= 0.97 ** (days - 7)
        concepts.append(
            {
                "id": cs.concept_id,
                "title": concept.title,
                "module": concept.module,
                "mastery": round(max(0.0, min(1.0, mastery)), 2),
                "attempts": cs.attempts,
                "dueAt": cs.srs_due.isoformat() if cs.srs_due else None,
            }
        )
    concepts.sort(key=lambda item: item["mastery"])
    core_concepts = [c for c in concepts if c["mastery"] > 0][:8]

    reviews_due = (
        session.query(ConceptState)
        .filter(ConceptState.srs_due.isnot(None), ConceptState.srs_due <= utcnow(), ConceptState.attempts > 0)
        .count()
    )

    return {
        "totals": {
            "steps": total_steps,
            "lessons": total_lessons,
            "attempts": total_attempts,
            "accuracy": round(passed_attempts / total_attempts, 2) if total_attempts else 0,
            "minutes": int(total_minutes),
            "reviews": session.scalar(select(func.count()).select_from(ReviewLog)) or 0,
        },
        "heatmap": heatmap,
        "level": level_progress(profile.xp),
        "streak": {
            "current": profile.streak_current,
            "best": profile.streak_best,
            "freezes": profile.freeze_tokens,
        },
        "accuracyByKind": accuracy_by_kind,
        "concepts": concepts,
        "coreConcepts": core_concepts,
        "weakConcepts": concepts[:5],
        "reviewsDue": reviews_due,
        "achievements": list_achievements(session),
        "modules": build_path(session, index),
    }
