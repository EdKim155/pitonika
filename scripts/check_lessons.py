#!/usr/bin/env python3
"""Проверка уроков одного модуля: схема, ссылки и эталонные решения.

Использование: python scripts/check_lessons.py m1
Не требует, чтобы остальные модули были наполнены.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))

from app.content.loader import ContentIndex, _validate_step  # noqa: E402
from app.content.schema import Concept, Lesson, Module  # noqa: E402
from app.runner.sandbox import resolve_interpreter, run_program, run_unit_tests  # noqa: E402
from app.services.grading import normalize_output  # noqa: E402

CONTENT = ROOT / "server" / "content"


def load_meta() -> tuple[dict[str, Concept], list[Module]]:
    raw = yaml.safe_load((CONTENT / "concepts.yaml").read_text(encoding="utf-8")) or {}
    concepts = {item["id"]: Concept.model_validate(item) for item in raw.get("concepts", [])}
    modules = []
    for path in sorted((CONTENT / "modules").glob("*.yaml")):
        modules.append(Module.model_validate(yaml.safe_load(path.read_text(encoding="utf-8"))))
    return concepts, modules


async def check(module_id: str) -> int:
    concepts, modules = load_meta()
    module_ids = {module.id for module in modules}
    errors: list[str] = []
    if module_id not in module_ids:
        print(f"Нет модуля {module_id}")
        return 1

    files = sorted((CONTENT / "lessons").glob(f"{module_id}.*.yaml"))
    if not files:
        print(f"Нет файлов уроков для {module_id}")
        return 1

    interpreter = resolve_interpreter(None)
    index = ContentIndex(concepts=concepts)
    total_steps = 0
    total_code = 0
    orders: dict[int, str] = {}

    for path in files:
        try:
            lesson = Lesson.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{path.name}: схема — {exc}")
            continue
        if lesson.module != module_id:
            errors.append(f"{path.name}: module={lesson.module}, ожидался {module_id}")
        if lesson.order in orders:
            errors.append(f"{path.name}: order={lesson.order} уже занят {orders[lesson.order]}")
        orders[lesson.order] = path.name
        for concept_id in lesson.concepts:
            if concept_id not in concepts:
                errors.append(f"{path.name}: неизвестный концепт {concept_id}")
        total_steps += len(lesson.steps)
        for step in lesson.steps:
            _validate_step(step, lesson, index, errors)
            if step.type not in ("code", "debug"):
                continue
            total_code += 1
            if step.mode == "io":
                for fixture in step.fixtures:
                    run = await run_program(step.solution, fixture.stdin, 6, interpreter)
                    actual = normalize_output(run.stdout, fixture.exact)
                    expected = normalize_output(fixture.stdout, fixture.exact)
                    if run.timed_out or run.exit_code != 0 or actual != expected:
                        errors.append(
                            f"{step.id}: эталон не проходит фикстуру. Получено {actual!r}, ожидалось {expected!r}; "
                            f"stderr={run.stderr[:160]!r}"
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
                    errors.append(f"{step.id}: эталон падает при импорте ({run.load_error or run.limit_hit})")
                for item in results:
                    if not item.get("passed"):
                        errors.append(f"{step.id}: тест «{item.get('name')}» не прошёл: {item.get('message')}")

    print(f"Модуль {module_id}: уроков {len(files)}, шагов {total_steps}, кодовых задач {total_code}")
    if errors:
        print("\nОшибки:")
        for error in errors:
            print(" -", error)
        return 1
    print("Проверка пройдена ✓")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Укажи модуль: python scripts/check_lessons.py m1")
        raise SystemExit(2)
    raise SystemExit(asyncio.run(check(sys.argv[1])))
