"""Песочница: свободный запуск кода."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.schemas import RunRequest
from app.db.session import get_session
from app.runner.sandbox import resolve_interpreter, run_program
from app.services.settings_store import get_settings

router = APIRouter(prefix="/api", tags=["run"])


@router.post("/run")
async def run(payload: RunRequest, session: Session = Depends(get_session)) -> dict:
    settings = get_settings(session)
    interpreter = resolve_interpreter(settings.get("python_path"))
    timeout_seconds = int(settings.get("timeout_seconds") or 5)
    result = await run_program(
        payload.code, payload.stdin, timeout_seconds, interpreter, docker=bool(settings.get("strict_mode"))
    )
    return {
        "stdout": result.stdout,
        "stderr": result.stderr,
        "exitCode": result.exit_code,
        "timedOut": result.timed_out,
        "durationMs": result.duration_ms,
        "truncated": result.truncated,
        "limitHit": result.limit_hit,
        "runnerError": result.runner_error,
    }
