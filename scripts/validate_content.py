#!/usr/bin/env python3
"""Проверка контента: схема, ссылки, решения против тестов."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server"))

from app.content.loader import load_content  # noqa: E402
from app.runner.sandbox import resolve_interpreter, run_program, run_unit_tests  # noqa: E402
from app.services.grading import normalize_output  # noqa: E402


async def validate() -> int:
    index = load_content()
    interpreter = resolve_interpreter(None)
    errors: list[str] = []
    checked = 0

    for lesson_id in index.lesson_order:
        lesson = index.lessons[lesson_id]
        for step in lesson.steps:
            if step.type not in ("code", "debug"):
                continue
            checked += 1
            if step.mode == "io":
                for fixture in step.fixtures:
                    run = await run_program(step.solution, fixture.stdin, 6, interpreter)
                    if run.timed_out:
                        errors.append(f"{step.id}: таймаут эталонного решения")
                        break
                    actual = normalize_output(run.stdout, fixture.exact)
                    expected = normalize_output(fixture.stdout, fixture.exact)
                    if actual != expected or run.exit_code != 0:
                        errors.append(
                            f"{step.id}: эталон не совпал с фикстурой (stdin={fixture.stdin!r}); "
                            f"получено {actual!r}, ожидалось {expected!r}; stderr={run.stderr[:200]!r}"
                        )
                        break
            else:
                run, results = await run_unit_tests(
                    step.solution,
                    [test.model_dump() for test in step.tests],
                    6,
                    interpreter,
                )
                if run.timed_out or run.load_error:
                    errors.append(f"{step.id}: ошибка загрузки/таймаут ({run.load_error or run.limit_hit})")
                for item in results:
                    if not item.get("passed"):
                        errors.append(f"{step.id}: тест «{item.get('name')}» не прошёл у эталона: {item.get('message')}")

    print(f"Проверено уроков: {len(index.lesson_order)}, шагов: {len(index.steps)}, кодовых задач: {checked}")
    print(f"Модулей: {len(index.modules)}, концептов: {len(index.concepts)}")
    if errors:
        print("\nОшибки:")
        for error in errors:
            print(" -", error)
        return 1
    print("Контент в порядке ✓")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(validate()))
