from __future__ import annotations

import pytest

from app.content import get_content
from app.content.loader import ContentError, load_content


def test_content_loads() -> None:
    index = load_content()
    assert len(index.modules) >= 4
    assert len(index.lesson_order) >= 19


def test_every_code_step_has_three_hints() -> None:
    index = get_content(reload=True)
    for step in index.steps.values():
        if step.type in ("code", "debug"):
            assert len(step.hints) == 3, step.id
            assert step.solution.strip(), step.id


def test_prerequisites_and_concepts_exist() -> None:
    index = load_content()
    for lesson in index.lessons.values():
        assert lesson.module in {module.id for module in index.modules}
        for concept in lesson.concepts:
            assert concept in index.concepts


def test_lesson_ids_are_stable_and_unique() -> None:
    index = load_content()
    assert len(index.lessons) == len(set(index.lessons))
    assert len(index.steps) == sum(len(lesson.steps) for lesson in index.lessons.values())


def test_content_error_is_readable(tmp_path) -> None:
    with pytest.raises(ContentError):
        load_content(tmp_path)
