from __future__ import annotations


def test_bootstrap_requires_onboarding(client) -> None:
    response = client.get("/api/bootstrap")
    assert response.status_code == 200
    assert response.json()["profile"]["onboarded"] is False


def test_onboarding_then_path(client) -> None:
    response = client.post(
        "/api/profile/onboarding",
        json={
            "name": "Тест",
            "goal": "base",
            "dailyMinutes": 10,
            "experience": "zero",
            "interests": ["games"],
            "timezone": "Europe/Moscow",
        },
    )
    assert response.status_code == 200
    assert response.json()["profile"]["onboarded"] is True

    bootstrap = client.get("/api/bootstrap").json()
    assert bootstrap["modulesCount"] >= 4
    assert any(module["lessons"][0]["status"] == "current" for module in bootstrap["path"] if module["lessons"])


def test_grade_and_complete_lesson(client) -> None:
    client.post("/api/profile/onboarding", json={"name": "Тест", "experience": "zero"})

    lesson = client.get("/api/content/lesson/m0.l1")
    assert lesson.status_code == 200
    payload = lesson.json()
    assert payload["steps"][0]["type"] == "theory"

    graded = client.post("/api/grade", json={"stepId": "m0.l1.s1", "durationMs": 1200}).json()
    assert graded["passed"] is True
    assert graded["xpGained"] == 5

    lesson_done = client.post("/api/lesson/m0.l1/complete").json()
    assert lesson_done["firstTime"] is True
    assert lesson_done["xpGained"] == 25

    progress = client.get("/api/progress/summary").json()
    assert progress["totals"]["lessons"] == 1


def test_settings_are_public_and_mask_key(client) -> None:
    data = client.get("/api/settings").json()
    assert data["pythonPath"]
    assert "apiKey" not in data
    assert data["keyMasked"] == ""

    saved = client.put("/api/settings", json={"dailyGoalXp": 60, "apiKey": "sk-test-1234"})
    assert saved.status_code == 200
    assert saved.json()["dailyGoalXp"] == 60
    assert saved.json()["keyMasked"].endswith("1234")


def test_export_import_roundtrip(client) -> None:
    client.post("/api/profile/onboarding", json={"name": "Экспорт"})
    exported = client.get("/api/export").json()
    assert "tables" in exported
    imported = client.post("/api/import", json=exported)
    assert imported.status_code == 200
    assert client.get("/api/bootstrap").json()["profile"]["name"] == "Экспорт"


def test_review_queue_and_answer(client) -> None:
    from datetime import datetime, timedelta, timezone

    from app.db.models import ConceptState
    from app.db.session import SessionLocal

    client.post("/api/profile/onboarding", json={"name": "Повтор", "experience": "zero"})
    graded = client.post("/api/grade", json={"stepId": "m0.l1.s2", "answers": [0]})
    assert graded.status_code == 200 and graded.json()["passed"] is True

    with SessionLocal() as session:
        state = session.get(ConceptState, "print")
        assert state is not None
        state.srs_due = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)
        session.commit()

    queue = client.get("/api/review/queue").json()
    assert queue["due"] >= 1
    card = next(item for item in queue["cards"] if item["conceptId"] == "print")
    assert card["correctAnswers"] == [0]

    answered = client.post("/api/review/answer", json={"conceptId": "print", "correct": True})
    assert answered.status_code == 200
    assert answered.json()["nextInterval"] >= 1
