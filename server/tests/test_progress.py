from __future__ import annotations

from datetime import date

from app.services.progress import effective_score, level_for_xp, level_progress, touch_streak, xp_for_level


def test_score_rules() -> None:
    assert effective_score(0, 0, False) == 1.0
    assert effective_score(1, 0, False) == 0.85
    assert effective_score(0, 1, False) == 0.85
    assert effective_score(0, 0, True) == 0.6


def test_levels_are_monotonic() -> None:
    previous = -1
    for level in range(1, 12):
        threshold = xp_for_level(level)
        assert threshold > previous
        previous = threshold
        assert level_for_xp(threshold) == level


def test_level_progress_percent() -> None:
    progress = level_progress(150)
    assert progress["level"] == 2
    assert 0 <= progress["percent"] <= 100


def test_streak_counts_consecutive_days() -> None:
    from app.db.models import Profile

    profile = Profile(id=1)
    day = date(2026, 1, 1)
    touch_streak(profile, day)
    assert profile.streak_current == 1
    touch_streak(profile, day + __import__("datetime").timedelta(days=1))
    assert profile.streak_current == 2
    touch_streak(profile, day + __import__("datetime").timedelta(days=4))
    assert profile.streak_current == 1


def test_streak_uses_freeze_for_single_gap() -> None:
    from app.db.models import Profile

    profile = Profile(id=1, streak_current=5, freeze_tokens=1, last_active_date=date(2026, 1, 1))
    touch_streak(profile, date(2026, 1, 3))
    assert profile.streak_current == 6
    assert profile.freeze_tokens == 0
