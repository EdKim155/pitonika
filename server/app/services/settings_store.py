"""Чтение и запись настроек и секретов."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.config import SECRETS_PATH
from app.db.models import Setting
from app.db.migrations import DEFAULT_SETTINGS


def _deep_merge(base: dict, patch: dict) -> dict:
    merged = dict(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def get_settings(session: Session) -> dict[str, Any]:
    stored = {row.key: _loads(row.value) for row in session.query(Setting).all()}
    return _deep_merge(DEFAULT_SETTINGS, stored)


def update_settings(session: Session, patch: dict[str, Any]) -> dict[str, Any]:
    current = get_settings(session)
    merged = _deep_merge(current, patch)
    for key, value in merged.items():
        row = session.get(Setting, key)
        payload = json.dumps(value, ensure_ascii=False)
        if row is None:
            session.add(Setting(key=key, value=payload))
        else:
            row.value = payload
    session.commit()
    return merged


def _loads(raw: str) -> Any:
    try:
        return json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return None


def read_secrets() -> dict[str, str]:
    try:
        data = json.loads(Path(SECRETS_PATH).read_text(encoding="utf-8"))
        return {str(k): str(v) for k, v in data.items() if v}
    except (OSError, json.JSONDecodeError):
        return {}


def write_secret(name: str, value: str) -> None:
    secrets = read_secrets()
    if value:
        secrets[name] = value
    else:
        secrets.pop(name, None)
    path = Path(SECRETS_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(secrets, ensure_ascii=False, indent=2), encoding="utf-8")
    os.chmod(path, 0o600)


def masked_key() -> str:
    key = read_secrets().get("api_key", "")
    if not key:
        return ""
    return f"…{key[-4:]}" if len(key) > 4 else "…"
