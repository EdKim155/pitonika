"""Исходник harness'а, который исполняется внутри песочницы для unit-тестов."""

HARNESS_SOURCE = r'''
import contextlib
import importlib.util
import io
import json
import os
import sys
import traceback

RESULTS_PATH = os.environ["PITONIKA_RESULTS"]
PROGRESS_PATH = os.environ.get("PITONIKA_PROGRESS", "")


def write_results(payload):
    with open(RESULTS_PATH, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False)


def mark(index):
    if PROGRESS_PATH:
        try:
            with open(PROGRESS_PATH, "w", encoding="utf-8") as fh:
                fh.write(str(index))
        except OSError:
            pass


with open("tests.json", "r", encoding="utf-8") as fh:
    tests = json.load(fh)

# Задача не должна зависеть от интерактивного ввода.
sys.stdin = io.StringIO("")

try:
    spec = importlib.util.spec_from_file_location("solution", "solution.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules["solution"] = module
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        spec.loader.exec_module(module)
except BaseException as exc:  # noqa: BLE001
    write_results({
        "load_error": f"{type(exc).__name__}: {exc}",
        "traceback": traceback.format_exc(limit=6),
        "results": [],
    })
    sys.exit(0)

namespace = dict(vars(module))
results = []

for index, test in enumerate(tests):
    mark(index)
    out = io.StringIO()
    err = io.StringIO()
    passed = False
    message = ""
    got_repr = ""
    try:
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            got = eval(test["call"], dict(namespace))
            expected = test.get("expected")
            if test.get("approx"):
                passed = abs(float(got) - float(expected)) <= 1e-6
            else:
                passed = got == expected
        got_repr = repr(got)
    except BaseException as exc:  # noqa: BLE001
        message = f"{type(exc).__name__}: {exc}"
        got_repr = ""
    results.append({
        "name": test.get("name") or test.get("call", ""),
        "passed": passed,
        "message": message,
        "got": got_repr,
        "expected": repr(test.get("expected")),
        "output": out.getvalue()[:2000],
        "stderr": err.getvalue()[:2000],
    })

write_results({"load_error": None, "results": results})
'''
