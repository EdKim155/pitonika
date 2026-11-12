"""Настройки приложения и проверка LLM."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.ai.client import PROVIDERS, probe
from app.runner.sandbox import docker_status
from app.api.schemas import SettingsPatch
from app.db.session import get_session
from app.services.settings_store import get_settings, masked_key, read_secrets, update_settings, write_secret

router = APIRouter(prefix="/api/settings", tags=["settings"])


def public_settings(session: Session) -> dict:
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
        "providers": [{"id": key, **value} for key, value in PROVIDERS.items()],
    }


@router.get("")
def get_settings_endpoint(session: Session = Depends(get_session)) -> dict:
    return public_settings(session)


@router.put("")
def put_settings(payload: SettingsPatch, session: Session = Depends(get_session)) -> dict:
    patch: dict = {}
    if payload.pythonPath is not None:
        patch["python_path"] = payload.pythonPath.strip() or "python3"
    if payload.timeoutSeconds is not None:
        patch["timeout_seconds"] = max(1, min(15, payload.timeoutSeconds))
    if payload.strictMode is not None:
        patch["strict_mode"] = bool(payload.strictMode)
    if payload.dailyGoalXp is not None:
        patch["daily_goal_xp"] = max(10, min(400, payload.dailyGoalXp))
    if payload.llm is not None:
        llm_patch = {k: v for k, v in payload.llm.items() if k in {"provider", "baseUrl", "model", "temperature", "maxTokens"}}
        mapping = {"baseUrl": "base_url", "maxTokens": "max_tokens"}
        normalized = {mapping.get(k, k): v for k, v in llm_patch.items()}
        patch["llm"] = normalized
    if payload.apiKey is not None:
        write_secret("api_key", payload.apiKey.strip())
    if patch:
        update_settings(session, patch)
    return public_settings(session)


@router.get("/docker/check")
async def docker_check() -> dict:
    return await docker_status()


@router.get("/llm/probe")
async def llm_probe(session: Session = Depends(get_session)) -> dict:
    return await probe(session)
