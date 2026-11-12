"""Pydantic-модели запросов API."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class OnboardingRequest(BaseModel):
    name: str = "Ученик"
    goal: str = "base"
    dailyMinutes: int = 10
    experience: str = "zero"
    interests: list[str] = Field(default_factory=list)
    timezone: str = "Europe/Moscow"


class GradeRequest(BaseModel):
    stepId: str
    code: str | None = None
    stdin: str | None = None
    answers: list[Any] | None = None
    answer: int | None = None
    order: list[str] | None = None
    text: str | None = None
    hintsUsed: int = 0
    revealed: bool = False
    durationMs: int = 0


class CompleteStepRequest(BaseModel):
    stepId: str
    durationMs: int = 0


class RunRequest(BaseModel):
    code: str = ""
    stdin: str = ""


class ReviewAnswerRequest(BaseModel):
    conceptId: str
    correct: bool


class SettingsPatch(BaseModel):
    pythonPath: str | None = None
    timeoutSeconds: int | None = None
    strictMode: bool | None = None
    dailyGoalXp: int | None = None
    llm: dict[str, Any] | None = None
    apiKey: str | None = None


class ChatRequest(BaseModel):
    lessonId: str | None = None
    stepId: str | None = None
    code: str | None = None
    messages: list[dict[str, str]] = Field(default_factory=list)


class HintRequest(BaseModel):
    stepId: str
    level: int = 1
    code: str | None = None


class ExplainErrorRequest(BaseModel):
    stepId: str
    code: str
    stderr: str


class ReviewCodeRequest(BaseModel):
    stepId: str
    code: str


class GenerateRequest(BaseModel):
    topic: str
    difficulty: int = 1


class PlanRequest(BaseModel):
    pass


class SnippetRequest(BaseModel):
    title: str = "Без названия"
    code: str = ""
