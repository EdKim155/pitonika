"""Промпты наставника. Все ответы — на русском, без готовых решений."""
from __future__ import annotations

import re
from typing import Any

SYSTEM_TUTOR = """Ты — Питоника, терпеливый наставник по Python для новичка, который учится с нуля.

Правила:
1. Отвечай по-русски, дружелюбно и кратко: обычно 60–120 слов.
2. НИКОГДА не давай готовое решение целиком, если ученик прямо не попросил «покажи решение».
3. Веди наводящими вопросами и маленькими шагами: сначала намёк, потом направление, потом структура.
4. Объясняй ошибки простыми словами и связывай их с конкретной строкой кода ученика.
5. Не выдумывай функции и библиотеки. Если не уверен — скажи об этом.
6. Не читай морали и не хвали чрезмерно. Одна короткая поддерживающая фраза — достаточно.
7. Код оформляй в markdown-блоке ```python, но только фрагменты-подсказки (1–3 строки).
8. Учитывай уровень ученика: не используй темы, которые он ещё не проходил, без пояснения.
"""


def _clip(text: str, limit: int) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else text[:limit] + "\n… (обрезано)"


def _context_block(context: dict[str, Any]) -> str:
    lines = []
    if context.get("lessonTitle"):
        lines.append(f"Урок: {context['lessonTitle']}")
    if context.get("stepPrompt"):
        lines.append(f"Задание: {_clip(context['stepPrompt'], 700)}")
    if context.get("concepts"):
        lines.append("Концепты: " + ", ".join(context["concepts"]))
    if context.get("code"):
        lines.append("Код ученика:\n```python\n" + _clip(context["code"], 1600) + "\n```")
    if context.get("stderr"):
        lines.append("Ошибка:\n```\n" + _clip(context["stderr"], 900) + "\n```")
    return "\n".join(lines)


def hint_messages(level: int, authored_hint: str, context: dict[str, Any]) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_TUTOR},
        {
            "role": "user",
            "content": (
                f"{_context_block(context)}\n\n"
                f"Дай подсказку уровня {level} из 3 (1 — лёгкий намёк, 2 — конкретное направление, "
                f"3 — почти структура решения, но без готового кода).\n"
                f"Авторская подсказка этого уровня: {authored_hint}\n"
                "Сформулируй её персонально под код ученика, максимум 60 слов."
            ),
        },
    ]


def explain_error_messages(context: dict[str, Any]) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_TUTOR},
        {
            "role": "user",
            "content": (
                f"{_context_block(context)}\n\n"
                "Объясни ошибку по шагам: что Python пытается сделать, почему падает и что проверить. "
                "Не пиши исправленный код целиком. Максимум 110 слов."
            ),
        },
    ]


def review_code_messages(context: dict[str, Any]) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_TUTOR},
        {
            "role": "user",
            "content": (
                f"{_context_block(context)}\n\n"
                "Разбери решение ученика: 1) что получилось хорошо; 2) что можно упростить или сделать понятнее; "
                "3) один питоничный приём, который стоит запомнить. Без переписывания всего кода. До 120 слов."
            ),
        },
    ]


def chat_messages(history: list[dict[str, str]], context: dict[str, Any]) -> list[dict[str, str]]:
    messages = [{"role": "system", "content": SYSTEM_TUTOR}]
    context_text = _context_block(context)
    if context_text:
        messages.append({"role": "system", "content": "Текущий контекст ученика:\n" + context_text})
    for item in history[-8:]:
        role = item.get("role")
        content = (item.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content[:2000]})
    return messages


def generate_messages(topic: str, difficulty: int, examples: list[str]) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_TUTOR},
        {
            "role": "user",
            "content": (
                f"Придумай одну учебную задачу по теме «{topic}», сложность {difficulty} из 3.\n"
                "Верни СТРОГО JSON без markdown-обёртки и комментариев:\n"
                '{"prompt": "...", "mode": "io|unit", "starter": "...", "signature": null, '
                '"fixtures": [{"stdin": "...", "stdout": "..."}], "tests": [{"name": "...", "call": "f(2, 3)", "expected": 5}], '
                '"hints": ["...", "...", "..."], "solution": "...", "explanation": "..."}\n'
                "Требования: решение на Python, без внешних библиотек; для mode=io используй реальный ввод/вывод и 2 фикстуры; "
                "для mode=unit — функцию и 3 теста. Подсказки не должны содержать полное решение.\n"
                f"Примеры задач этого уровня:\n{chr(10).join(examples[:2])}"
            ),
        },
    ]


def plan_messages(weak_concepts: list[str], due_reviews: int, lessons_left: int) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_TUTOR},
        {
            "role": "user",
            "content": (
                "Составь план обучения на неделю: 5 коротких пунктов, каждый — конкретное действие на 10–20 минут. "
                f"Слабые темы: {', '.join(weak_concepts) or 'нет данных'}. "
                f"Повторений к выполнению: {due_reviews}. Осталось уроков: {lessons_left}. "
                "Без воды, нумерованным списком."
            ),
        },
    ]


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def leaks_solution(answer: str, solution: str) -> bool:
    if not solution.strip() or not answer.strip():
        return False
    lines = [line.strip() for line in solution.splitlines() if line.strip() and not line.strip().startswith("#")]
    if len(lines) < 3:
        return False
    normalized = _normalize(answer)
    hits = sum(1 for line in lines if _normalize(line) in normalized)
    return hits >= max(2, len(lines) - 1)


def reference_line(solution: str) -> str:
    for line in solution.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            return stripped
    return ""
