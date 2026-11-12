from __future__ import annotations

from datetime import date, timedelta

from app.content import get_content
from app.services.grading import grade_step
from app.runner.sandbox import resolve_interpreter
import pytest


@pytest.mark.asyncio
async def test_quiz_grading() -> None:
    index = get_content()
    step = index.steps["m0.l1.s2"]
    interpreter = resolve_interpreter(None)
    good = await grade_step(step, {"answers": [0]}, interpreter, 5)
    bad = await grade_step(step, {"answers": [2]}, interpreter, 5)
    assert good.passed and not bad.passed


@pytest.mark.asyncio
async def test_blank_grading() -> None:
    index = get_content()
    step = index.steps["m0.l1.s4"]
    interpreter = resolve_interpreter(None)
    result = await grade_step(step, {"answers": ['"Python"']}, interpreter, 5)
    assert result.passed
    wrong = await grade_step(step, {"answers": ["Python"]}, interpreter, 5)
    assert not wrong.passed


@pytest.mark.asyncio
async def test_io_grading_detects_wrong_output() -> None:
    index = get_content()
    step = index.steps["m0.l1.s6"]
    interpreter = resolve_interpreter(None)
    good = await grade_step(step, {"code": 'print("Привет, мир!")'}, interpreter, 5)
    bad = await grade_step(step, {"code": 'print("привет")'}, interpreter, 5)
    assert good.passed
    assert not bad.passed
    assert bad.details["cases"][0]["expected"] == "Привет, мир!"
