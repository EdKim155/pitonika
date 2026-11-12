"""Общие фикстуры pytest: изолированная БД и приложение."""
from __future__ import annotations

import os
import tempfile

os.environ.setdefault("PITONIKA_DATA", tempfile.mkdtemp(prefix="pitonika-test-"))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db.migrations import init_db  # noqa: E402
from app.db.models import (  # noqa: E402
    AchievementUnlock,
    Attempt,
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
from app.db.session import SessionLocal  # noqa: E402
from app.db.migrations import _bootstrap_profile, _bootstrap_settings  # noqa: E402
from app.main import app  # noqa: E402

MODELS = [
    AchievementUnlock,
    Attempt,
    ChatMessage,
    ConceptState,
    DailyStat,
    EventLog,
    GeneratedTask,
    LessonProgress,
    ReviewLog,
    Setting,
    Snippet,
    StepProgress,
    Profile,
]


@pytest.fixture(scope="session", autouse=True)
def _database() -> None:
    init_db()


@pytest.fixture(autouse=True)
def clean_state() -> None:
    with SessionLocal() as session:
        for model in MODELS:
            session.execute(model.__table__.delete())
        session.commit()
        _bootstrap_profile(session)
        _bootstrap_settings(session)
        session.commit()
    yield


@pytest.fixture()
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client
