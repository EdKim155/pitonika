"""XP, уровни, streak, дневная статистика, mastery и достижения."""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from typing import Any, Callable
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import (
    AchievementUnlock,
    Attempt,
    ConceptState,
    DailyStat,
    EventLog,
    LessonProgress,
    Profile,
    ReviewLog,
    StepProgress,
    utcnow,
)

LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1500, 2400, 3600, 5200]
LEVEL_TITLES = [
    "Новичок",
    "Ученик",
    "Практик",
    "Кодер",
    "Инженер",
    "Мастер",
    "Архитектор",
    "Наставник",
    "Легенда",
]
SRS_INTERVALS = [1, 3, 7, 16, 35, 75]


def xp_for_level(level: int) -> int:
    if level <= len(LEVEL_THRESHOLDS):
        return LEVEL_THRESHOLDS[max(0, level - 1)]
    return LEVEL_THRESHOLDS[-1] + 2000 * (level - len(LEVEL_THRESHOLDS))


def level_for_xp(xp: int) -> int:
    level = 1
    while level < 99 and xp >= xp_for_level(level + 1):
        level += 1
    return level


def level_title(level: int) -> str:
    return LEVEL_TITLES[min(level - 1, len(LEVEL_TITLES) - 1)]


def level_progress(xp: int) -> dict[str, Any]:
    level = level_for_xp(xp)
    current = xp_for_level(level)
    upcoming = xp_for_level(level + 1)
    span = max(1, upcoming - current)
    return {
        "level": level,
        "title": level_title(level),
        "xp": xp,
        "levelStartXp": current,
        "nextLevelXp": upcoming,
        "percent": round(max(0.0, min(1.0, (xp - current) / span)) * 100),
    }


def local_today(profile: Profile) -> date:
    try:
        return datetime.now(ZoneInfo(profile.timezone)).date()
    except Exception:  # noqa: BLE001
        return date.today()


def get_profile(session: Session) -> Profile:
    profile = session.get(Profile, 1)
    if profile is None:
        profile = Profile(id=1)
        session.add(profile)
        session.commit()
    return profile


def get_daily(session: Session, day: date) -> DailyStat:
    stat = session.get(DailyStat, day)
    if stat is None:
        stat = DailyStat(date=day)
        session.add(stat)
        session.flush()
    return stat


def _settings_goal(session: Session) -> int:
    from app.services.settings_store import get_settings

    return int(get_settings(session).get("daily_goal_xp") or 40)


def touch_streak(profile: Profile, day: date) -> None:
    last = profile.last_active_date
    if last == day:
        return
    profile.streak_current = profile.streak_current or 0
    profile.freeze_tokens = profile.freeze_tokens or 0
    if last is None:
        profile.streak_current = 1
    elif (day - last).days == 1:
        profile.streak_current += 1
    elif (day - last).days == 2 and profile.freeze_tokens > 0:
        profile.freeze_tokens -= 1
        profile.streak_current += 1
    else:
        profile.streak_current = 1
    profile.last_active_date = day
    profile.streak_current = profile.streak_current or 0
    profile.streak_best = max(profile.streak_best or 0, profile.streak_current)
    if profile.streak_current > 0 and profile.streak_current % 7 == 0 and profile.freeze_tokens < 2:
        profile.freeze_tokens += 1


def _apply_activity(
    session: Session,
    profile: Profile,
    xp_gain: int,
    steps: int = 0,
    lessons: int = 0,
    minutes: int = 0,
    force_qualify: bool = False,
) -> DailyStat:
    day = local_today(profile)
    stat = get_daily(session, day)
    stat.xp += max(0, xp_gain)
    stat.steps += steps
    stat.lessons += lessons
    stat.minutes += max(0, minutes)
    goal = _settings_goal(session)
    stat.goal_met = stat.xp >= goal
    if force_qualify or stat.goal_met or stat.lessons > 0:
        if not stat.qualifies:
            stat.qualifies = True
            touch_streak(profile, day)
    return stat


def effective_score(attempts_before: int, hints_used: int, revealed: bool) -> float:
    if revealed:
        return 0.6
    if attempts_before > 0 or hints_used > 0:
        return 0.85
    return 1.0


def update_mastery(cs: ConceptState, score: float) -> None:
    alpha = 0.35
    cs.mastery = max(0.0, min(1.0, cs.mastery + alpha * (score - cs.mastery)))
    cs.attempts += 1
    if score >= 0.8:
        cs.correct += 1


def update_srs(cs: ConceptState, passed: bool) -> None:
    if passed:
        cs.srs_reps = min(cs.srs_reps + 1, len(SRS_INTERVALS) - 1)
    else:
        cs.srs_reps = max(0, cs.srs_reps - 1)
    interval = SRS_INTERVALS[min(cs.srs_reps, len(SRS_INTERVALS) - 1)]
    cs.srs_interval = interval
    cs.srs_due = utcnow() + timedelta(days=interval)


ACHIEVEMENTS: list[dict[str, Any]] = [
    {"id": "first_step", "title": "Первый шаг", "description": "Заверши первый шаг урока", "icon": "footprints", "check": lambda s: s["steps_done"] >= 1},
    {"id": "first_code", "title": "Это код!", "description": "Впервые напиши и запусти код", "icon": "code", "check": lambda s: s["code_attempts"] >= 1},
    {"id": "first_lesson", "title": "Урок пройден", "description": "Заверши первый урок", "icon": "book-check", "check": lambda s: s["lessons_done"] >= 1},
    {"id": "ten_steps", "title": "Десять шагов", "description": "Пройди 10 шагов", "icon": "layers", "check": lambda s: s["steps_done"] >= 10},
    {"id": "fifty_steps", "title": "Полсотни", "description": "Пройди 50 шагов", "icon": "layers", "check": lambda s: s["steps_done"] >= 50},
    {"id": "code_10", "title": "Десять запусков", "description": "Запусти код 10 раз", "icon": "terminal", "check": lambda s: s["code_attempts"] >= 10},
    {"id": "perfect_10", "title": "С первой попытки", "description": "10 шагов без подсказок и ошибок", "icon": "target", "check": lambda s: s["perfect_steps"] >= 10},
    {"id": "streak_3", "title": "Три дня подряд", "description": "Занимайся 3 дня подряд", "icon": "flame", "check": lambda s: s["streak_best"] >= 3},
    {"id": "streak_7", "title": "Неделя силы", "description": "Занимайся 7 дней подряд", "icon": "flame", "check": lambda s: s["streak_best"] >= 7},
    {"id": "streak_30", "title": "Месяц в деле", "description": "Занимайся 30 дней подряд", "icon": "flame", "check": lambda s: s["streak_best"] >= 30},
    {"id": "level_2", "title": "Уровень 2", "description": "Достигни второго уровня", "icon": "star", "check": lambda s: s["level"] >= 2},
    {"id": "level_3", "title": "Уровень 3", "description": "Достигни третьего уровня", "icon": "star", "check": lambda s: s["level"] >= 3},
    {"id": "level_5", "title": "Уровень 5", "description": "Достигни пятого уровня", "icon": "star", "check": lambda s: s["level"] >= 5},
    {"id": "module_0", "title": "Модуль «Старт»", "description": "Пройди вводный модуль", "icon": "flag", "check": lambda s: s["modules_done"] >= 1},
    {"id": "module_1", "title": "Переменные освоены", "description": "Пройди модуль о переменных и типах", "icon": "flag", "check": lambda s: s["modules_done"] >= 2},
    {"id": "module_2", "title": "Ветвления освоены", "description": "Пройди модуль о ветвлениях", "icon": "flag", "check": lambda s: s["modules_done"] >= 3},
    {"id": "module_3", "title": "Циклы освоены", "description": "Пройди модуль о циклах", "icon": "flag", "check": lambda s: s["modules_done"] >= 4},
    {"id": "xp_500", "title": "500 XP", "description": "Набери 500 XP", "icon": "zap", "check": lambda s: s["xp"] >= 500},
    {"id": "xp_2000", "title": "2000 XP", "description": "Набери 2000 XP", "icon": "zap", "check": lambda s: s["xp"] >= 2000},
    {"id": "review_10", "title": "Повторение — мать учения", "description": "Пройди 10 повторений", "icon": "rotate-ccw", "check": lambda s: s["reviews"] >= 10},
]


def stats_snapshot(session: Session, profile: Profile, content_module_count: int) -> dict[str, Any]:
    steps_done = session.scalar(select(func.count()).select_from(StepProgress).where(StepProgress.status == "done")) or 0
    lessons_done = session.scalar(select(func.count()).select_from(LessonProgress).where(LessonProgress.status == "done")) or 0
    code_attempts = session.scalar(select(func.count()).select_from(Attempt).where(Attempt.kind == "code")) or 0
    perfect = (
        session.scalar(
            select(func.count())
            .select_from(StepProgress)
            .where(StepProgress.status == "done", StepProgress.score >= 0.99, StepProgress.hints_used == 0)
        )
        or 0
    )
    reviews = session.scalar(select(func.count()).select_from(ReviewLog)) or 0
    return {
        "steps_done": steps_done,
        "lessons_done": lessons_done,
        "code_attempts": code_attempts,
        "perfect_steps": perfect,
        "reviews": reviews,
        "streak_best": profile.streak_best,
        "xp": profile.xp,
        "level": profile.level,
        "modules_done": lessons_done,  # уточняется в content-сервисе при необходимости
    }


def check_achievements(
    session: Session,
    profile: Profile,
    stats: dict[str, Any],
) -> list[dict[str, Any]]:
    unlocked = {row.id for row in session.query(AchievementUnlock).all()}
    fresh: list[dict[str, Any]] = []
    for item in ACHIEVEMENTS:
        if item["id"] in unlocked:
            continue
        try:
            if item["check"](stats):
                session.add(AchievementUnlock(id=item["id"]))
                fresh.append({k: item[k] for k in ("id", "title", "description", "icon")})
        except Exception:  # noqa: BLE001
            continue
    return fresh


def list_achievements(session: Session) -> list[dict[str, Any]]:
    unlocked = {row.id: row.unlocked_at for row in session.query(AchievementUnlock).all()}
    result = []
    for item in ACHIEVEMENTS:
        result.append(
            {
                "id": item["id"],
                "title": item["title"],
                "description": item["description"],
                "icon": item["icon"],
                "unlockedAt": unlocked[item["id"]].isoformat() if item["id"] in unlocked else None,
            }
        )
    return result


def log_event(session: Session, event_type: str, payload: dict[str, Any] | None = None) -> None:
    session.add(EventLog(type=event_type, payload=json.dumps(payload or {}, ensure_ascii=False)))


def public_profile(session: Session, profile: Profile) -> dict[str, Any]:
    day = local_today(profile)
    stat = session.get(DailyStat, day)
    xp_today = stat.xp if stat else 0
    goal = _settings_goal(session)
    return {
        "name": profile.name,
        "goal": profile.goal,
        "dailyMinutes": profile.daily_minutes,
        "dailyGoalXp": goal,
        "experience": profile.experience,
        "interests": json.loads(profile.interests or "[]"),
        "onboarded": profile.onboarded,
        "timezone": profile.timezone,
        "xpToday": xp_today,
        "goalMet": bool(stat.goal_met) if stat else False,
        "streak": {
            "current": profile.streak_current,
            "best": profile.streak_best,
            "freezes": profile.freeze_tokens,
            "lastActiveDate": profile.last_active_date.isoformat() if profile.last_active_date else None,
        },
        "level": level_progress(profile.xp),
        "unlockedIndex": profile.unlocked_index,
    }
