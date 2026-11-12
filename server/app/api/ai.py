"""ИИ-наставник: стриминг чата, подсказки, разбор ошибок и генерация задач."""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.ai import prompts
from app.ai.client import LLMNotConfigured, complete, probe, resolve_config, stream_chat
from app.api.schemas import (
    ChatRequest,
    ExplainErrorRequest,
    GenerateRequest,
    HintRequest,
    PlanRequest,
    ReviewCodeRequest,
)
from app.content import get_content
from app.content.schema import CodeStep
from app.db.models import ChatMessage, ConceptState, GeneratedTask
from app.db.session import get_session
from app.runner.sandbox import resolve_interpreter, run_program, run_unit_tests
from app.services.grading import _diagnosis
from app.services.progress import get_profile, log_event
from app.services.settings_store import get_settings

router = APIRouter(prefix="/api/ai", tags=["ai"])

NUDGE = "Давай без готового ответа: покажи, что уже пробовал и на каком шаге застрял — подскажу направление."


def _context(session: Session, step_id: str | None, code: str | None, stderr: str | None = None) -> dict[str, Any]:
    index = get_content()
    context: dict[str, Any] = {}
    if step_id and step_id in index.steps:
        step = index.steps[step_id]
        lesson = index.lessons[index.step_lesson[step_id]]
        context["lessonTitle"] = lesson.title
        context["stepPrompt"] = getattr(step, "prompt", None) or getattr(step, "question", None) or ""
        context["concepts"] = step.concepts or lesson.concepts
        context["solution"] = getattr(step, "solution", "")
        context["authoredHints"] = list(getattr(step, "hints", []) or [])
    if code:
        context["code"] = code
    if stderr:
        context["stderr"] = stderr
    return context


@router.get("/status")
async def status(session: Session = Depends(get_session)) -> dict:
    return await probe(session)


@router.post("/chat")
async def chat(payload: ChatRequest, session: Session = Depends(get_session)):
    cfg = resolve_config(session)
    if cfg is None or not cfg.model:
        raise HTTPException(status_code=409, detail="Наставник не настроен. Открой Настройки → Наставник.")
    context = _context(session, payload.stepId, payload.code)
    history = [{"role": m.get("role", "user"), "content": m.get("content", "")} for m in payload.messages]
    messages = prompts.chat_messages(history, context)
    last_user = next((m["content"] for m in reversed(history) if m["role"] == "user"), "")
    if last_user:
        session.add(ChatMessage(lesson_id=payload.lessonId or "", role="user", content=last_user[:4000]))
    solution = str(context.get("solution") or "")

    async def event_stream():
        chunks: list[str] = []
        try:
            async for delta in stream_chat(cfg, messages):
                chunks.append(delta)
                yield f"data: {json.dumps({'delta': delta}, ensure_ascii=False)}\n\n"
            answer = "".join(chunks)
            if solution and prompts.leaks_solution(answer, solution):
                answer = NUDGE
                yield f"data: {json.dumps({'delta': answer, 'replace': True}, ensure_ascii=False)}\n\n"
            session.add(ChatMessage(lesson_id=payload.lessonId or "", role="assistant", content=answer[:8000]))
            session.commit()
            yield f"data: {json.dumps({'done': True}, ensure_ascii=False)}\n\n"
        except Exception as exc:  # noqa: BLE001
            yield f"data: {json.dumps({'error': str(exc)}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'done': True}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/hint")
async def hint(payload: HintRequest, session: Session = Depends(get_session)) -> dict:
    index = get_content()
    step = index.steps.get(payload.stepId)
    if step is None:
        raise HTTPException(status_code=404, detail="Шаг не найден")
    authored = list(getattr(step, "hints", []) or [])
    level = max(1, min(3, payload.level))
    fallback = authored[level - 1] if len(authored) >= level else (authored[0] if authored else "Перечитай условие и попробуй разбить задачу на два шага.")
    cfg = resolve_config(session)
    if cfg is None or not cfg.model:
        return {"hint": fallback, "level": level, "source": "authored"}
    context = _context(session, payload.stepId, payload.code)
    try:
        answer = await complete(cfg, prompts.hint_messages(level, fallback, context))
        answer = answer.strip()
        solution = str(context.get("solution") or "")
        if solution and prompts.leaks_solution(answer, solution):
            answer = fallback
        return {"hint": answer or fallback, "level": level, "source": "ai"}
    except Exception:  # noqa: BLE001
        return {"hint": fallback, "level": level, "source": "authored"}


@router.post("/explain-error")
async def explain_error(payload: ExplainErrorRequest, session: Session = Depends(get_session)) -> dict:
    context = _context(session, payload.stepId, payload.code, payload.stderr)
    fallback = _diagnosis(payload.stderr, False) or "Посмотри на строку, указанную в трейсбеке, и проверь типы значений."
    cfg = resolve_config(session)
    if cfg is None or not cfg.model:
        return {"explanation": fallback, "source": "authored"}
    try:
        answer = await complete(cfg, prompts.explain_error_messages(context))
        return {"explanation": answer.strip(), "source": "ai"}
    except Exception:  # noqa: BLE001
        return {"explanation": fallback, "source": "authored"}


@router.post("/review-code")
async def review_code(payload: ReviewCodeRequest, session: Session = Depends(get_session)) -> dict:
    context = _context(session, payload.stepId, payload.code)
    cfg = resolve_config(session)
    if cfg is None or not cfg.model:
        return {
            "review": "Решение работает. Проверь читаемость: понятные имена переменных, отсутствие дублирования, короткие функции.",
            "source": "authored",
        }
    try:
        answer = await complete(cfg, prompts.review_code_messages(context))
        return {"review": answer.strip(), "source": "ai"}
    except Exception:  # noqa: BLE001
        return {"review": "Решение работает. Попробуй назвать переменные так, чтобы код читался как предложение.", "source": "authored"}


@router.post("/generate")
async def generate(payload: GenerateRequest, session: Session = Depends(get_session)) -> dict:
    cfg = resolve_config(session)
    if cfg is None or not cfg.model:
        raise HTTPException(status_code=409, detail="Для генерации задач нужен настроенный наставник.")
    index = get_content()
    examples = []
    for step in index.steps.values():
        if step.type == "code":
            examples.append(getattr(step, "prompt", "")[:200])
        if len(examples) >= 3:
            break
    try:
        raw = await complete(cfg, prompts.generate_messages(payload.topic, payload.difficulty, examples))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Провайдер недоступен: {exc}") from exc
    spec = _extract_json(raw)
    if not spec:
        raise HTTPException(status_code=502, detail="Модель вернула не JSON. Попробуй ещё раз.")
    task, error = await _validate_generated(spec, session)
    if task is None:
        raise HTTPException(status_code=422, detail=f"Задача не прошла проверку: {error}")
    session.add(
        GeneratedTask(
            topic=payload.topic,
            difficulty=payload.difficulty,
            payload=json.dumps(task, ensure_ascii=False),
            validated=True,
        )
    )
    log_event(session, "ai_generate", {"topic": payload.topic, "difficulty": payload.difficulty})
    session.commit()
    return {"task": task}


def _extract_json(raw: str) -> dict | None:
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        return json.loads(raw[start : end + 1])
    except ValueError:
        return None


async def _validate_generated(spec: dict, session: Session) -> tuple[dict | None, str | None]:
    try:
        prompt = str(spec.get("prompt") or "").strip()
        mode = spec.get("mode") if spec.get("mode") in ("io", "unit") else "io"
        solution = str(spec.get("solution") or "")
        hints = [str(h) for h in (spec.get("hints") or [])][:3]
        if not prompt or not solution.strip() or len(hints) < 3:
            return None, "не хватает prompt/solution/hints"
        candidate = CodeStep(
            id="generated.0.0",
            type="code",
            prompt=prompt,
            mode=mode,
            starter=str(spec.get("starter") or ""),
            signature=spec.get("signature"),
            fixtures=[{"stdin": f.get("stdin", ""), "stdout": f.get("stdout", "")} for f in (spec.get("fixtures") or [])],
            tests=[{"name": t.get("name"), "call": t.get("call", ""), "expected": t.get("expected"), "approx": bool(t.get("approx"))} for t in (spec.get("tests") or [])],
            hints=hints,
            solution=solution,
            explanation=str(spec.get("explanation") or ""),
        )
        settings = get_settings(session)
        interpreter = resolve_interpreter(settings.get("python_path"))
        timeout = int(settings.get("timeout_seconds") or 5)
        if mode == "io":
            if not candidate.fixtures:
                return None, "нет фикстур для io"
            for fixture in candidate.fixtures:
                run = await run_program(
                    solution, fixture.stdin, timeout, interpreter, docker=bool(settings.get("strict_mode"))
                )
                from app.services.grading import normalize_output

                if normalize_output(run.stdout) != normalize_output(fixture.stdout) or run.exit_code != 0:
                    return None, "эталонное решение не проходит собственные фикстуры"
        else:
            if not candidate.tests:
                return None, "нет тестов для unit"
            run, results = await run_unit_tests(
                solution,
                [t.model_dump() for t in candidate.tests],
                timeout,
                interpreter,
                docker=bool(settings.get("strict_mode")),
            )
            if run.load_error or not results or any(not item.get("passed") for item in results):
                return None, "эталонное решение не проходит собственные тесты"
        task = {
            "prompt": candidate.prompt,
            "mode": candidate.mode,
            "starter": candidate.starter,
            "signature": candidate.signature,
            "fixtures": [f.model_dump() for f in candidate.fixtures],
            "tests": [t.model_dump() for t in candidate.tests],
            "hints": candidate.hints,
            "solution": candidate.solution,
            "explanation": candidate.explanation,
        }
        return task, None
    except Exception as exc:  # noqa: BLE001
        return None, f"{type(exc).__name__}: {exc}"


@router.post("/plan")
async def plan(_: PlanRequest, session: Session = Depends(get_session)) -> dict:
    profile = get_profile(session)
    index = get_content()
    states = session.query(ConceptState).order_by(ConceptState.mastery).limit(5).all()
    weak = [index.concepts[s.concept_id].title for s in states if s.concept_id in index.concepts]
    due = session.query(ConceptState).filter(ConceptState.srs_due.isnot(None), ConceptState.attempts > 0).count()
    lessons_left = max(0, len(index.lesson_order) - profile.unlocked_index)
    cfg = resolve_config(session)
    if cfg is None or not cfg.model:
        items = [f"Повтори темы: {', '.join(weak)}" if weak else "Пройди первый урок"]
        items.append("10 минут практики на слабую тему")
        if due:
            items.append(f"Закрой {min(due, 10)} повторений")
        items.append("Один новый урок")
        return {"plan": items, "source": "authored"}
    try:
        answer = await complete(cfg, prompts.plan_messages(weak, due, lessons_left))
        items = [line.strip(" -•\t") for line in answer.splitlines() if line.strip()][:7]
        return {"plan": items, "source": "ai"}
    except Exception:  # noqa: BLE001
        return {"plan": ["Пройди один урок", "10 минут практики", "Закрой повторения"], "source": "authored"}
