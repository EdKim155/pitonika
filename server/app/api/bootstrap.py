"""Bootstrap, онбординг, профиль."""
from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.schemas import OnboardingRequest
from app.content import get_content
from app.db.models import ConceptState, Profile, utcnow
from app.db.session import get_session
from app.services.learning import build_path, progress_summary
from app.services.progress import get_profile, local_today, log_event, public_profile
from app.services.settings_store import get_settings, masked_key, read_secrets

router = APIRouter(prefix="/api", tags=["bootstrap"])


def _public_settings(session: Session) -> dict:
    cfg = get_settings(session)
    llm = cfg.get("llm") or {}
    return {
        "pythonPath": cfg.get("python_path"),
        "timeoutSeconds": cfg.get("timeout_seconds"),
        "strictMode": bool(cfg.get("strict_mode")),
        "dailyGoalXp": cfg.get("daily_goal_xp"),
        "llm": {
            "provider": llm.get("provider"),
            "baseUrl": llm.get("base_url"),
            "model": llm.get("model"),
            "temperature": llm.get("temperature"),
            "maxTokens": llm.get("max_tokens"),
        },
        "hasKey": bool(read_secrets().get("api_key")),
        "keyMasked": masked_key(),
    }


@router.get("/health")
def health(session: Session = Depends(get_session)) -> dict:
    return {"ok": True, "time": datetime.now().isoformat(), "pythonPath": get_settings(session).get("python_path")}


@router.get("/bootstrap")
def bootstrap(session: Session = Depends(get_session)) -> dict:
    index = get_content()
    profile = get_profile(session)
    due = (
        session.query(ConceptState)
        .filter(ConceptState.srs_due.isnot(None), ConceptState.srs_due <= utcnow(), ConceptState.attempts > 0)
        .count()
    )
    today = local_today(profile)
    return {
        "profile": public_profile(session, profile),
        "settings": _public_settings(session),
        "path": build_path(session, index),
        "dueReviews": due,
        "today": today.isoformat(),
        "modulesCount": len(index.modules),
        "lessonsCount": len(index.lesson_order),
        "version": "1.0.0",
    }


@router.post("/profile/onboarding")
def onboarding(payload: OnboardingRequest, session: Session = Depends(get_session)) -> dict:
    profile = get_profile(session)
    profile.name = payload.name.strip() or "Ученик"
    profile.goal = payload.goal
    profile.daily_minutes = max(5, min(120, payload.dailyMinutes))
    profile.experience = payload.experience
    profile.interests = json.dumps(payload.interests, ensure_ascii=False)
    profile.timezone = payload.timezone or profile.timezone
    profile.onboarded = True
    # Цель по XP: примерно 4 XP за минуту, минимум 20.
    target = max(20, profile.daily_minutes * 4)
    from app.db.models import Setting

    row = session.get(Setting, "daily_goal_xp")
    if row is None:
        session.add(Setting(key="daily_goal_xp", value=json.dumps(target)))
    else:
        row.value = json.dumps(target)
    if payload.experience != "zero":
        # Позволяем начать со второго модуля, не блокируя первые уроки.
        index = get_content()
        start = 0
        for position, lesson_id in enumerate(index.lesson_order):
            if index.lessons[lesson_id].module == "m1":
                start = position
                break
        profile.unlocked_index = max(profile.unlocked_index, start)
    log_event(session, "onboarding", {"goal": payload.goal, "experience": payload.experience})
    session.commit()
    return {"ok": True, "profile": public_profile(session, profile)}


@router.patch("/profile")
def patch_profile(payload: dict, session: Session = Depends(get_session)) -> dict:
    profile = session.get(Profile, 1)
    if profile is None:
        profile = get_profile(session)
    for key, attr in (("name", "name"), ("goal", "goal"), ("dailyMinutes", "daily_minutes"), ("timezone", "timezone")):
        if key in payload and payload[key] is not None:
            setattr(profile, attr, payload[key])
    session.commit()
    return {"ok": True, "profile": public_profile(session, profile)}


@router.get("/progress/summary")
def summary(session: Session = Depends(get_session)) -> dict:
    return progress_summary(session, get_content())
