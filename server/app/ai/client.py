"""Провайдер-агностичный клиент LLM (OpenAI-совместимый + Anthropic)."""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import AsyncIterator

import httpx

from app.services.settings_store import get_settings, read_secrets

PROVIDERS: dict[str, dict] = {
    "ollama": {"label": "Ollama (локально)", "baseUrl": "http://127.0.0.1:11434/v1", "requiresKey": False},
    "lmstudio": {"label": "LM Studio (локально)", "baseUrl": "http://127.0.0.1:1234/v1", "requiresKey": False},
    "openai": {"label": "OpenAI", "baseUrl": "https://api.openai.com/v1", "requiresKey": True},
    "deepseek": {"label": "DeepSeek", "baseUrl": "https://api.deepseek.com/v1", "requiresKey": True},
    "openrouter": {"label": "OpenRouter", "baseUrl": "https://openrouter.ai/api/v1", "requiresKey": True},
    "custom": {"label": "Свой OpenAI-совместимый", "baseUrl": "", "requiresKey": False},
    "anthropic": {"label": "Anthropic", "baseUrl": "https://api.anthropic.com", "requiresKey": True},
}


class LLMNotConfigured(RuntimeError):
    pass


@dataclass
class LLMConfig:
    provider: str
    base_url: str
    model: str
    api_key: str
    temperature: float = 0.4
    max_tokens: int = 900


def resolve_config(session) -> LLMConfig | None:
    settings = get_settings(session)
    llm = settings.get("llm") or {}
    provider = (llm.get("provider") or "").strip()
    if not provider or provider not in PROVIDERS:
        return None
    base_url = (llm.get("base_url") or PROVIDERS[provider]["baseUrl"]).rstrip("/")
    model = (llm.get("model") or "").strip()
    api_key = read_secrets().get("api_key", "")
    if PROVIDERS[provider]["requiresKey"] and not api_key:
        return None
    if not base_url and provider == "custom":
        return None
    return LLMConfig(
        provider=provider,
        base_url=base_url,
        model=model,
        api_key=api_key,
        temperature=float(llm.get("temperature") or 0.4),
        max_tokens=int(llm.get("max_tokens") or 900),
    )


def _headers(cfg: LLMConfig) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if cfg.api_key:
        if cfg.provider == "anthropic":
            headers["x-api-key"] = cfg.api_key
            headers["anthropic-version"] = "2023-06-01"
        else:
            headers["Authorization"] = f"Bearer {cfg.api_key}"
    return headers


async def list_models(cfg: LLMConfig, timeout: float = 6.0) -> dict:
    url = f"{cfg.base_url}/models"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url, headers=_headers(cfg))
        if response.status_code >= 400:
            return {"ok": False, "models": [], "error": f"HTTP {response.status_code}"}
        data = response.json()
        raw = data.get("data") or data.get("models") or []
        models = []
        for item in raw:
            if isinstance(item, dict):
                models.append(item.get("id") or item.get("name") or "")
            elif isinstance(item, str):
                models.append(item)
        return {"ok": True, "models": [m for m in models if m], "error": None}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "models": [], "error": f"{type(exc).__name__}: {exc}"}


async def detect_provider() -> dict | None:
    """Пробует найти локальный провайдер без ключа."""
    for provider in ("ollama", "lmstudio"):
        cfg = LLMConfig(provider=provider, base_url=PROVIDERS[provider]["baseUrl"], model="", api_key="")
        result = await list_models(cfg, timeout=1.5)
        if result["ok"] and result["models"]:
            return {"provider": provider, "baseUrl": cfg.base_url, "models": result["models"]}
    return None


async def probe(session) -> dict:
    cfg = resolve_config(session)
    if cfg is None:
        detected = await detect_provider()
        return {"configured": False, "detected": detected}
    models = await list_models(cfg)
    return {
        "configured": True,
        "provider": cfg.provider,
        "baseUrl": cfg.base_url,
        "model": cfg.model,
        "ok": models["ok"],
        "models": models["models"],
        "error": models["error"],
    }


def _openai_payload(cfg: LLMConfig, messages: list[dict[str, str]], stream: bool) -> dict:
    payload = {
        "model": cfg.model,
        "messages": messages,
        "temperature": cfg.temperature,
        "max_tokens": cfg.max_tokens,
        "stream": stream,
    }
    return payload


async def stream_chat(cfg: LLMConfig, messages: list[dict[str, str]]) -> AsyncIterator[str]:
    if not cfg.model:
        raise LLMNotConfigured("Не выбрана модель")
    if cfg.provider == "anthropic":
        async for chunk in _stream_anthropic(cfg, messages):
            yield chunk
        return
    async for chunk in _stream_openai(cfg, messages):
        yield chunk


async def _stream_openai(cfg: LLMConfig, messages: list[dict[str, str]]) -> AsyncIterator[str]:
    url = f"{cfg.base_url}/chat/completions"
    timeout = httpx.Timeout(connect=8, read=120, write=20, pool=8)
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", url, headers=_headers(cfg), json=_openai_payload(cfg, messages, True)) as response:
            if response.status_code >= 400:
                body = (await response.aread()).decode("utf-8", errors="replace")[:500]
                raise RuntimeError(f"Провайдер ответил {response.status_code}: {body}")
            async for line in response.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    parsed = json.loads(data)
                except ValueError:
                    continue
                choices = parsed.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}
                text = delta.get("content")
                if text:
                    yield text


async def _stream_anthropic(cfg: LLMConfig, messages: list[dict[str, str]]) -> AsyncIterator[str]:
    system = "\n".join(m["content"] for m in messages if m["role"] == "system")
    converted = [m for m in messages if m["role"] != "system"]
    payload = {
        "model": cfg.model,
        "system": system,
        "messages": converted,
        "max_tokens": cfg.max_tokens,
        "temperature": cfg.temperature,
        "stream": True,
    }
    url = f"{cfg.base_url}/v1/messages"
    timeout = httpx.Timeout(connect=8, read=120, write=20, pool=8)
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", url, headers=_headers(cfg), json=payload) as response:
            if response.status_code >= 400:
                body = (await response.aread()).decode("utf-8", errors="replace")[:500]
                raise RuntimeError(f"Провайдер ответил {response.status_code}: {body}")
            async for line in response.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                try:
                    parsed = json.loads(data)
                except ValueError:
                    continue
                if parsed.get("type") == "content_block_delta":
                    text = (parsed.get("delta") or {}).get("text")
                    if text:
                        yield text


async def complete(cfg: LLMConfig, messages: list[dict[str, str]]) -> str:
    parts: list[str] = []
    async for chunk in stream_chat(cfg, messages):
        parts.append(chunk)
    return "".join(parts)
