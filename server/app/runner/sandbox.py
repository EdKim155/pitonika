"""Песочница исполнения Python-кода ученика.

Обычный режим — отдельный процесс с таймаутом, лимитом вывода и временной
папкой. Строгий режим (опция) запускает код в Docker-контейнере без сети.
"""
from __future__ import annotations

import asyncio
import json
import os
import resource
import shutil
import signal
import stat
import sys
import tempfile
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.config import FSIZE_LIMIT_BYTES, OUTPUT_CAP_BYTES, RUNS_DIR
from app.runner.harness_source import HARNESS_SOURCE

DOCKER_IMAGE = "python:3.12-slim"
_docker_ready = False


@dataclass
class RunResult:
    stdout: str = ""
    stderr: str = ""
    exit_code: int | None = None
    timed_out: bool = False
    duration_ms: int = 0
    truncated: bool = False
    limit_hit: str | None = None
    results: list[dict[str, Any]] = field(default_factory=list)
    load_error: str | None = None
    runner_error: str | None = None


def docker_binary() -> str | None:
    return shutil.which("docker")


async def docker_status() -> dict[str, Any]:
    binary = docker_binary()
    if not binary:
        return {"available": False, "version": None, "error": "Docker не установлен"}
    try:
        proc = await asyncio.create_subprocess_exec(
            binary,
            "version",
            "--format",
            "{{.Server.Version}}",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out, err = await asyncio.wait_for(proc.communicate(), timeout=8)
        if proc.returncode != 0:
            return {"available": False, "version": None, "error": err.decode("utf-8", "replace").strip()[:200]}
        return {"available": True, "version": out.decode().strip(), "error": None}
    except Exception as exc:  # noqa: BLE001
        return {"available": False, "version": None, "error": f"{type(exc).__name__}: {exc}"}


async def _ensure_docker_image() -> None:
    global _docker_ready
    if _docker_ready:
        return
    binary = docker_binary()
    if binary is None:
        raise RuntimeError("Docker не найден")
    inspect = await asyncio.create_subprocess_exec(
        binary,
        "image",
        "inspect",
        DOCKER_IMAGE,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    if await inspect.wait() != 0:
        pull = await asyncio.create_subprocess_exec(
            binary,
            "pull",
            DOCKER_IMAGE,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            _, err = await asyncio.wait_for(pull.communicate(), timeout=240)
        except asyncio.TimeoutError:
            raise RuntimeError("Не удалось скачать образ Python для Docker") from None
        if pull.returncode != 0:
            raise RuntimeError(f"docker pull: {err.decode('utf-8', 'replace')[:200]}")
    _docker_ready = True


def _preexec(timeout_seconds: int):  # noqa: ANN202
    def limit() -> None:
        try:
            resource.setrlimit(resource.RLIMIT_CPU, (timeout_seconds, timeout_seconds + 1))
        except (ValueError, OSError):
            pass
        try:
            resource.setrlimit(resource.RLIMIT_FSIZE, (FSIZE_LIMIT_BYTES, FSIZE_LIMIT_BYTES))
        except (ValueError, OSError):
            pass
        try:
            resource.setrlimit(resource.RLIMIT_NOFILE, (96, 96))
        except (ValueError, OSError):
            pass
        try:
            resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
        except (ValueError, OSError):
            pass

    return limit


def resolve_interpreter(configured: str | None) -> str:
    if configured:
        candidate = Path(configured).expanduser()
        if candidate.exists() and os.access(candidate, os.X_OK):
            return str(candidate)
        found = shutil.which(configured)
        if found:
            return found
    return sys.executable or "python3"


def _decode(raw: bytes, truncated: bool) -> str:
    text = raw.decode("utf-8", errors="replace")
    if truncated:
        text += "\n… вывод обрезан (лимит 64 КБ)"
    return text


async def _spawn(
    args: list[str],
    workdir: Path,
    stdin_data: bytes,
    timeout_seconds: int,
    extra_env: dict[str, str] | None = None,
    docker: bool = False,
) -> RunResult:
    started = time.monotonic()
    out_path = workdir / ".stdout"
    err_path = workdir / ".stderr"
    container_name: str | None = None

    env: dict[str, str]
    if docker:
        try:
            await _ensure_docker_image()
        except Exception as exc:  # noqa: BLE001
            return RunResult(
                runner_error=f"Docker недоступен: {type(exc).__name__}: {exc}",
                duration_ms=int((time.monotonic() - started) * 1000),
            )
        binary = docker_binary() or "docker"
        container_name = f"pitonika-{uuid.uuid4().hex[:10]}"
        command = [
            binary,
            "run",
            "--rm",
            "-i",
            "--name",
            container_name,
            "--network",
            "none",
            "--memory",
            "256m",
            "--cpus",
            "1",
            "--pids-limit",
            "64",
            "-v",
            f"{workdir}:/work",
            "-w",
            "/work",
            "--user",
            f"{os.getuid()}:{os.getgid()}",
        ]
        for key, value in (extra_env or {}).items():
            command += ["-e", f"{key}={value}"]
        command += [DOCKER_IMAGE, "python", *args[1:]]
        env = dict(os.environ)
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUNBUFFERED"] = "1"
        args = command
    else:
        env = {
            "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
            "LANG": "en_US.UTF-8",
            "LC_ALL": "en_US.UTF-8",
            "PYTHONIOENCODING": "utf-8",
            "PYTHONDONTWRITEBYTECODE": "1",
            "PYTHONUNBUFFERED": "1",
            "HOME": str(workdir),
            "TMPDIR": str(workdir),
        }
        if extra_env:
            env.update(extra_env)

    stdout_fh = out_path.open("wb")
    stderr_fh = err_path.open("wb")
    proc: asyncio.subprocess.Process | None = None
    timed_out = False
    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            cwd=str(workdir),
            stdin=asyncio.subprocess.PIPE,
            stdout=stdout_fh,
            stderr=stderr_fh,
            env=env,
            start_new_session=True,
            preexec_fn=None if docker else _preexec(timeout_seconds),
        )
        try:
            await asyncio.wait_for(proc.communicate(input=stdin_data), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            timed_out = True
            _kill_tree(proc)
            try:
                await asyncio.wait_for(proc.wait(), timeout=3)
            except asyncio.TimeoutError:
                pass
            await proc.wait()
    except Exception as exc:  # noqa: BLE001
        if proc is not None:
            _kill_tree(proc)
        return RunResult(
            runner_error=f"{type(exc).__name__}: {exc}",
            duration_ms=int((time.monotonic() - started) * 1000),
        )
    finally:
        stdout_fh.close()
        stderr_fh.close()
        if container_name:
            await _remove_container(container_name)

    duration = int((time.monotonic() - started) * 1000)
    out_bytes, out_truncated = _read_capped(out_path)
    err_bytes, err_truncated = _read_capped(err_path)
    exit_code = proc.returncode if proc else None

    limit_hit = None
    stderr_text = _decode(err_bytes, err_truncated)
    if timed_out:
        limit_hit = "timeout"
    elif exit_code in (-signal.SIGXFSZ, 128 + signal.SIGXFSZ):
        limit_hit = "fsize"
    elif "MemoryError" in stderr_text:
        limit_hit = "memory"

    return RunResult(
        stdout=_decode(out_bytes, out_truncated),
        stderr=stderr_text,
        exit_code=exit_code,
        timed_out=timed_out,
        duration_ms=duration,
        truncated=out_truncated or err_truncated,
        limit_hit=limit_hit,
    )


async def _remove_container(name: str) -> None:
    binary = docker_binary()
    if binary is None:
        return
    try:
        proc = await asyncio.create_subprocess_exec(
            binary,
            "rm",
            "-f",
            name,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await asyncio.wait_for(proc.wait(), timeout=10)
    except Exception:  # noqa: BLE001
        pass


def _kill_tree(proc: asyncio.subprocess.Process) -> None:
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        try:
            proc.kill()
        except ProcessLookupError:
            pass


def _read_capped(path: Path) -> tuple[bytes, bool]:
    try:
        size = path.stat().st_size
        with path.open("rb") as fh:
            data = fh.read(OUTPUT_CAP_BYTES)
        return data, size > OUTPUT_CAP_BYTES
    except OSError:
        return b"", False


def _make_workdir() -> Path:
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    path = Path(tempfile.mkdtemp(prefix=f"{uuid.uuid4().hex[:10]}-", dir=RUNS_DIR))
    os.chmod(path, stat.S_IRWXU)
    return path


def _cleanup(workdir: Path) -> None:
    shutil.rmtree(workdir, ignore_errors=True)


async def run_program(
    code: str,
    stdin: str,
    timeout_seconds: int,
    interpreter: str,
    docker: bool = False,
) -> RunResult:
    workdir = _make_workdir()
    try:
        (workdir / "main.py").write_text(code, encoding="utf-8")
        return await _spawn(
            [interpreter, "-u", "main.py"],
            workdir,
            stdin.encode("utf-8"),
            timeout_seconds,
            docker=docker,
        )
    finally:
        _cleanup(workdir)


async def run_unit_tests(
    code: str,
    tests: list[dict[str, Any]],
    timeout_seconds: int,
    interpreter: str,
    docker: bool = False,
) -> tuple[RunResult, list[dict[str, Any]]]:
    """Возвращает результат процесса и структурированные результаты тестов."""
    workdir = _make_workdir()
    results_name = ".results.json"
    progress_name = ".progress"
    try:
        (workdir / "solution.py").write_text(code, encoding="utf-8")
        (workdir / "tests.json").write_text(json.dumps(tests, ensure_ascii=False), encoding="utf-8")
        (workdir / "harness.py").write_text(HARNESS_SOURCE, encoding="utf-8")
        result = await _spawn(
            [interpreter, "-u", "harness.py"],
            workdir,
            b"",
            timeout_seconds,
            extra_env={"PITONIKA_RESULTS": results_name, "PITONIKA_PROGRESS": progress_name},
            docker=docker,
        )
        payload: dict[str, Any] = {}
        results_path = workdir / results_name
        progress_path = workdir / progress_name
        if results_path.exists():
            try:
                payload = json.loads(results_path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                payload = {}
        result.results = payload.get("results", []) or []
        result.load_error = payload.get("load_error")
        if "traceback" in payload and payload["traceback"]:
            result.stderr = (result.stderr + "\n" + payload["traceback"]).strip()
        if result.timed_out and progress_path.exists():
            try:
                index = int(progress_path.read_text(encoding="utf-8").strip() or "-1")
                result.limit_hit = f"timeout:test:{index}"
            except (OSError, ValueError):
                pass
        return result, result.results
    finally:
        _cleanup(workdir)
