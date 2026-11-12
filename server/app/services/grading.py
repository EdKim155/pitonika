"""Проверка ответов ученика: тесты, фикстуры, квизы."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.content.schema import CodeStep, DebugStep, Step
from app.runner.sandbox import RunResult, run_program, run_unit_tests


@dataclass
class GradeResult:
    passed: bool
    details: dict[str, Any] = field(default_factory=dict)
    duration_ms: int = 0


def normalize_output(text: str, exact: bool = False) -> str:
    if exact:
        return text
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip() for line in normalized.split("\n")]
    while lines and lines[-1] == "":
        lines.pop()
    while lines and lines[0] == "":
        lines.pop(0)
    return "\n".join(lines)


def _diagnosis(stderr: str, timed_out: bool, load_error: str | None = None) -> str:
    if timed_out:
        return "Похоже, программа не завершается. Проверь условие цикла — оно должно когда-то стать ложным."
    text = f"{load_error or ''}\n{stderr or ''}"
    if "EOFError" in text:
        return "Программа ждёт ввод, но данных не хватило. Заполни поле «Тестовый ввод» или проверь количество вызовов input()."
    if "IndentationError" in text or "TabError" in text:
        return "Проблема с отступами: внутри блоков нужны ровно 4 пробела, без табов."
    if "SyntaxError" in text:
        return "Python не смог разобрать код: проверь скобки, двоеточия и кавычки в указанной строке."
    if "NameError" in text:
        return "Используется имя, которое ещё не определено: проверь опечатки и порядок строк."
    if "TypeError" in text:
        return "Операция не подходит для этих типов. Например, строку и число нельзя просто сложить — приведи типы."
    if "ZeroDivisionError" in text:
        return "Деление на ноль: проверь, может ли делитель оказаться нулём."
    if "IndexError" in text:
        return "Индекс вышел за границы списка: помни, что нумерация начинается с 0."
    if "KeyError" in text:
        return "В словаре нет такого ключа. Проверь написание или используй .get()."
    if "ValueError" in text:
        return "Значение не подошло для операции — часто это int() от текста, который не является числом."
    return ""


def _line_of_error(stderr: str) -> int | None:
    match = re.search(r'line (\d+)', stderr or "")
    return int(match.group(1)) if match else None


async def grade_step(
    step: Step,
    payload: dict[str, Any],
    interpreter: str,
    timeout_seconds: int,
    docker: bool = False,
) -> GradeResult:
    if step.type == "quiz":
        selected = payload.get("answers") or []
        selected_set = sorted({int(x) for x in selected if isinstance(x, (int, str)) and str(x).isdigit()})
        passed = selected_set == sorted(step.answers)
        return GradeResult(passed, {"kind": "quiz", "selected": selected_set, "expected": sorted(step.answers)})

    if step.type == "predict":
        answer = payload.get("answer")
        passed = isinstance(answer, int) and answer == step.answer
        return GradeResult(passed, {"kind": "predict", "selected": answer, "expected": step.answer})

    if step.type == "blank":
        answers = [str(x).strip() for x in (payload.get("answers") or [])]
        checks = []
        passed = True
        for blank, given in zip(step.blanks, answers + [""] * len(step.blanks)):
            allowed = {blank.answer.strip(), *[a.strip() for a in blank.accept]}
            ok = given in allowed
            passed = passed and ok
            checks.append({"given": given, "expected": blank.answer, "passed": ok, "hint": blank.hint})
        return GradeResult(passed, {"kind": "blank", "checks": checks})

    if step.type == "parsons":
        order = [str(x) for x in (payload.get("order") or [])]
        passed = order == list(step.solution)
        return GradeResult(
            passed,
            {"kind": "parsons", "order": order, "expected": list(step.solution)},
        )

    if step.type == "open":
        text = str(payload.get("text") or "").strip()
        words = len(text.split())
        passed = words >= step.min_words
        return GradeResult(passed, {"kind": "open", "words": words, "minWords": step.min_words})

    if step.type in ("code", "debug"):
        return await _grade_code(step, payload, interpreter, timeout_seconds, docker)

    if step.type == "theory":
        return GradeResult(True, {"kind": "theory"})

    return GradeResult(False, {"kind": "unknown", "message": "Неизвестный тип шага"})


async def _grade_code(
    step: CodeStep | DebugStep,
    payload: dict[str, Any],
    interpreter: str,
    timeout_seconds: int,
    docker: bool = False,
) -> GradeResult:
    code = str(payload.get("code") or "")
    if not code.strip():
        return GradeResult(False, {"kind": step.mode, "message": "Пока пусто — напиши решение в редакторе."})

    if step.mode == "unit":
        tests = [test.model_dump() for test in step.tests]
        run, results = await run_unit_tests(code, tests, timeout_seconds, interpreter, docker=docker)
        failed = [item for item in results if not item.get("passed")]
        passed = bool(results) and not failed and not run.load_error and not run.timed_out
        details = {
            "kind": "unit",
            "tests": results,
            "stdout": run.stdout,
            "stderr": run.stderr,
            "timedOut": run.timed_out,
            "loadError": run.load_error,
            "exitCode": run.exit_code,
            "diagnosis": _diagnosis(run.stderr, run.timed_out, run.load_error),
            "errorLine": _line_of_error(run.stderr),
            "limitHit": run.limit_hit,
        }
        return GradeResult(passed, details, run.duration_ms)

    cases = []
    passed = True
    total_duration = 0
    last: RunResult | None = None
    for fixture in step.fixtures:
        run = await run_program(code, fixture.stdin, timeout_seconds, interpreter, docker=docker)
        total_duration += run.duration_ms
        last = run
        actual = normalize_output(run.stdout, fixture.exact)
        expected = normalize_output(fixture.stdout, fixture.exact)
        case_passed = actual == expected and not run.timed_out and run.exit_code == 0
        passed = passed and case_passed
        cases.append(
            {
                "stdin": fixture.stdin,
                "expected": expected,
                "actual": actual,
                "stderr": run.stderr,
                "passed": case_passed,
                "timedOut": run.timed_out,
                "exitCode": run.exit_code,
            }
        )
        if run.timed_out:
            break

    diagnosis = ""
    if last is not None:
        diagnosis = _diagnosis(last.stderr, last.timed_out)
    details = {
        "kind": "io",
        "cases": cases,
        "stdout": last.stdout if last else "",
        "stderr": last.stderr if last else "",
        "timedOut": bool(last and last.timed_out),
        "diagnosis": diagnosis,
        "errorLine": _line_of_error(last.stderr) if last else None,
        "limitHit": last.limit_hit if last else None,
    }
    return GradeResult(passed, details, total_duration)
