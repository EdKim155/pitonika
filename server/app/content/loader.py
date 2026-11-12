"""Загрузка, валидация и индексация учебного контента."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from pydantic import ValidationError

from app.config import CONTENT_DIR
from app.content.schema import Concept, Lesson, Module, Step

STEP_ID_RE = re.compile(r"^[a-z0-9]+(\.[a-z0-9]+)+$")


class ContentError(RuntimeError):
    """Ошибка в учебном контенте."""


@dataclass
class ContentIndex:
    concepts: dict[str, Concept] = field(default_factory=dict)
    modules: list[Module] = field(default_factory=list)
    lessons: dict[str, Lesson] = field(default_factory=dict)
    lesson_order: list[str] = field(default_factory=list)
    steps: dict[str, Step] = field(default_factory=dict)
    step_lesson: dict[str, str] = field(default_factory=dict)

    def lesson_steps(self, lesson_id: str) -> list[Step]:
        return self.lessons[lesson_id].steps

    def module_lessons(self, module_id: str) -> list[Lesson]:
        return [self.lessons[lid] for lid in self.lesson_order if self.lessons[lid].module == module_id]


def _load_yaml(path: Path) -> object:
    try:
        with path.open("r", encoding="utf-8") as fh:
            return yaml.safe_load(fh)
    except yaml.YAMLError as exc:
        raise ContentError(f"{path.name}: нечитаемый YAML — {exc}") from exc


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ContentError(message)


def load_content(content_dir: Path | None = None) -> ContentIndex:
    base = content_dir or CONTENT_DIR
    index = ContentIndex()
    errors: list[str] = []

    concepts_path = base / "concepts.yaml"
    if concepts_path.exists():
        raw = _load_yaml(concepts_path) or {}
        for item in raw.get("concepts", []):
            try:
                concept = Concept.model_validate(item)
            except ValidationError as exc:
                errors.append(f"concepts.yaml: {exc}")
                continue
            index.concepts[concept.id] = concept

    for path in sorted((base / "modules").glob("*.yaml")):
        raw = _load_yaml(path) or {}
        try:
            module = Module.model_validate(raw)
        except ValidationError as exc:
            errors.append(f"{path.name}: {exc}")
            continue
        index.modules.append(module)

    index.modules.sort(key=lambda m: m.number)

    for path in sorted((base / "lessons").glob("*.yaml")):
        raw = _load_yaml(path) or {}
        try:
            lesson = Lesson.model_validate(raw)
        except ValidationError as exc:
            errors.append(f"{path.name}: {exc}")
            continue
        if lesson.id in index.lessons:
            errors.append(f"{path.name}: повторяется id урока {lesson.id}")
            continue
        index.lessons[lesson.id] = lesson

    for module in index.modules:
        if not any(lesson.module == module.id for lesson in index.lessons.values()):
            errors.append(f"модуль {module.id} не содержит уроков")

    lessons_sorted = sorted(index.lessons.values(), key=lambda l: (l.module, l.order))
    module_numbers = {m.id: m.number for m in index.modules}
    lessons_sorted.sort(key=lambda l: (module_numbers.get(l.module, 999), l.order))
    index.lesson_order = [lesson.id for lesson in lessons_sorted]

    for lesson in lessons_sorted:
        if lesson.module not in module_numbers:
            errors.append(f"урок {lesson.id}: неизвестный модуль {lesson.module}")
        for concept_id in lesson.concepts:
            if concept_id not in index.concepts:
                errors.append(f"урок {lesson.id}: неизвестный концепт {concept_id}")
        if not lesson.steps:
            errors.append(f"урок {lesson.id}: нет шагов")
        for step in lesson.steps:
            _validate_step(step, lesson, index, errors)
            if step.id in index.steps:
                errors.append(f"повторяется id шага {step.id}")
            index.steps[step.id] = step
            index.step_lesson[step.id] = lesson.id

    if errors:
        raise ContentError("Ошибки контента:\n- " + "\n- ".join(errors))
    if not index.lesson_order:
        raise ContentError("Контент пуст: нет ни одного урока")
    return index


def _validate_step(step: Step, lesson: Lesson, index: ContentIndex, errors: list[str]) -> None:
    if not STEP_ID_RE.match(step.id):
        errors.append(f"шаг {step.id}: id должен быть вида m1.l2.s3")
    if not step.id.startswith(lesson.id + "."):
        errors.append(f"шаг {step.id}: id должен начинаться с {lesson.id}.")
    for concept_id in step.concepts:
        if concept_id not in index.concepts:
            errors.append(f"шаг {step.id}: неизвестный концепт {concept_id}")

    if step.type in ("code", "debug"):
        if len(step.hints) != 3:
            errors.append(f"шаг {step.id}: нужно ровно 3 подсказки (сейчас {len(step.hints)})")
        if step.mode == "io" and not step.fixtures:
            errors.append(f"шаг {step.id}: для режима io нужны fixtures")
        if step.mode == "unit" and not step.tests:
            errors.append(f"шаг {step.id}: для режима unit нужны tests")
        if not step.solution.strip():
            errors.append(f"шаг {step.id}: нет эталонного решения")
    if step.type == "quiz":
        if len(step.answers) == 0:
            errors.append(f"шаг {step.id}: не задан ответ")
        for answer in step.answers:
            if answer < 0 or answer >= len(step.options):
                errors.append(f"шаг {step.id}: ответ {answer} вне диапазона options")
    if step.type == "predict":
        if step.answer < 0 or step.answer >= len(step.options):
            errors.append(f"шаг {step.id}: ответ вне диапазона options")
    if step.type == "parsons":
        if not step.solution:
            errors.append(f"шаг {step.id}: пустое решение")
        pool = list(step.lines)
        for line in step.solution:
            if line in pool:
                pool.remove(line)
            else:
                errors.append(f"шаг {step.id}: строки {line!r} нет в lines")
    if step.type == "blank":
        markers = [int(m) for m in re.findall(r"\{\{(\d+)\}\}", step.template)]
        if not markers:
            errors.append(f"шаг {step.id}: в template нет плейсхолдеров {{{{1}}}}")
        if len(step.blanks) != len(markers):
            errors.append(f"шаг {step.id}: blanks ({len(step.blanks)}) не совпадает с плейсхолдерами ({len(markers)})")
