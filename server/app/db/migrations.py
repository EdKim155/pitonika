"""Инициализация БД, бэкапы и настройки по умолчанию."""
from __future__ import annotations

import json
import shutil
import time
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import BACKUPS_DIR, DB_PATH, ensure_dirs
from app.db.models import Base, Profile, Setting
from app.db.session import SessionLocal, engine

SCHEMA_VERSION = 1

DEFAULT_SETTINGS: dict[str, object] = {
    "python_path": "python3",
    "timeout_seconds": 5,
    "strict_mode": False,
    "daily_goal_xp": 40,
    "llm": {
        "provider": None,
        "base_url": "",
        "model": "",
        "temperature": 0.4,
        "max_tokens": 900,
    },
}


def init_db() -> None:
    ensure_dirs()
    if DB_PATH.exists() and DB_PATH.stat().st_size > 0:
        backup_dir = BACKUPS_DIR
        backup_dir.mkdir(parents=True, exist_ok=True)
        stamps = sorted(backup_dir.glob("app-*.db"))
        # Держим только 5 последних бэкапов.
        for old in stamps[:-4]:
            old.unlink(missing_ok=True)
        if len(stamps) < 5:
            name = f"app-{datetime.now().strftime('%Y%m%d-%H%M%S')}.db"
            shutil.copy2(DB_PATH, backup_dir / name)

    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.exec_driver_sql("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)")
        row = conn.exec_driver_sql("SELECT version FROM schema_version").fetchone()
        if row is None:
            conn.exec_driver_sql(f"INSERT INTO schema_version (version) VALUES ({SCHEMA_VERSION})")

    with SessionLocal() as session:
        _bootstrap_profile(session)
        _bootstrap_settings(session)
        session.commit()


def _bootstrap_profile(session: Session) -> None:
    profile = session.get(Profile, 1)
    if profile is None:
        session.add(Profile(id=1))


def _bootstrap_settings(session: Session) -> None:
    existing = {row.key for row in session.scalars(select(Setting)).all()}
    for key, value in DEFAULT_SETTINGS.items():
        if key not in existing:
            session.add(Setting(key=key, value=json.dumps(value, ensure_ascii=False)))


def today() -> date:
    return date.today()


def now_ts() -> float:
    return time.time()
