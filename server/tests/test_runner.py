from __future__ import annotations

import pytest

from app.content import get_content
from app.runner.sandbox import resolve_interpreter, run_program, run_unit_tests
from app.services.grading import normalize_output


def test_normalize_output() -> None:
    assert normalize_output("a  \nb\t\n\n") == "a\nb"
    assert normalize_output("\n\nA\n") == "A"
    assert normalize_output("a \n", exact=True) == "a \n"


@pytest.mark.asyncio
async def test_run_program_stdout_and_stdin() -> None:
    interpreter = resolve_interpreter(None)
    result = await run_program('name = input()\nprint("Hi,", name)', "Ann\n", 5, interpreter)
    assert result.exit_code == 0
    assert normalize_output(result.stdout) == "Hi, Ann"
    assert not result.timed_out


@pytest.mark.asyncio
async def test_infinite_loop_is_killed() -> None:
    interpreter = resolve_interpreter(None)
    result = await run_program("while True:\n    pass\n", "", 1, interpreter)
    assert result.timed_out
    assert result.limit_hit == "timeout"


@pytest.mark.asyncio
async def test_output_is_capped() -> None:
    interpreter = resolve_interpreter(None)
    code = "for _ in range(200000):\n    print('x' * 40)\n"
    result = await run_program(code, "", 5, interpreter)
    assert result.truncated


@pytest.mark.asyncio
async def test_unit_tests_harness() -> None:
    interpreter = resolve_interpreter(None)
    code = "def add(a, b):\n    return a + b\n"
    tests = [
        {"name": "2+3", "call": "add(2, 3)", "expected": 5},
        {"name": "0+0", "call": "add(0, 0)", "expected": 0},
    ]
    run, results = await run_unit_tests(code, tests, 5, interpreter)
    assert not run.load_error
    assert all(item["passed"] for item in results)


@pytest.mark.asyncio
async def test_unit_tests_report_failure() -> None:
    interpreter = resolve_interpreter(None)
    code = "def add(a, b):\n    return a - b\n"
    run, results = await run_unit_tests(code, [{"call": "add(2, 3)", "expected": 5}], 5, interpreter)
    assert run.load_error is None
    assert results and results[0]["passed"] is False


@pytest.mark.asyncio
async def test_syntax_error_is_reported() -> None:
    interpreter = resolve_interpreter(None)
    result = await run_program("print('a'\n", "", 5, interpreter)
    assert result.exit_code != 0
    assert "SyntaxError" in result.stderr


@pytest.mark.asyncio
async def test_content_solutions_pass() -> None:
    """Каждое эталонное решение из контента проходит свои проверки."""
    index = get_content()
    interpreter = resolve_interpreter(None)
    checked = 0
    for step in index.steps.values():
        if step.type not in ("code", "debug"):
            continue
        checked += 1
        if step.mode == "io":
            for fixture in step.fixtures:
                run = await run_program(step.solution, fixture.stdin, 6, interpreter)
                assert not run.timed_out, step.id
                assert normalize_output(run.stdout, fixture.exact) == normalize_output(fixture.stdout, fixture.exact), step.id
        else:
            run, results = await run_unit_tests(step.solution, [t.model_dump() for t in step.tests], 6, interpreter)
            assert not run.load_error, f"{step.id}: {run.load_error}"
            assert all(item["passed"] for item in results), step.id
    assert checked >= 30
