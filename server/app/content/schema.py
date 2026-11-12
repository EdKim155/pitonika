"""Pydantic-схема учебного контента (YAML)."""
from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field


class Concept(BaseModel):
    id: str
    title: str
    description: str = ""
    module: str = ""


class Module(BaseModel):
    id: str
    title: str
    subtitle: str = ""
    number: int
    color: str = "emerald"
    icon: str = "sparkles"
    description: str = ""


class Fixture(BaseModel):
    stdin: str = ""
    stdout: str = ""
    exact: bool = False


class TestCase(BaseModel):
    name: str | None = None
    call: str
    expected: Any
    approx: bool = False


class Blank(BaseModel):
    answer: str
    accept: list[str] = Field(default_factory=list)
    hint: str = ""


class _StepBase(BaseModel):
    id: str
    title: str | None = None
    concepts: list[str] = Field(default_factory=list)


class TheoryStep(_StepBase):
    type: Literal["theory"] = "theory"
    body: str
    example: str | None = None
    aside: str | None = None


class QuizStep(_StepBase):
    type: Literal["quiz"] = "quiz"
    question: str
    options: list[str]
    answers: list[int]
    explanation: str = ""
    multiple: bool = False
    code: str | None = None


class PredictStep(_StepBase):
    type: Literal["predict"] = "predict"
    code: str
    options: list[str]
    answer: int
    explanation: str = ""


class BlankStep(_StepBase):
    type: Literal["blank"] = "blank"
    prompt: str
    template: str
    blanks: list[Blank]
    explanation: str = ""


class ParsonsStep(_StepBase):
    type: Literal["parsons"] = "parsons"
    prompt: str
    lines: list[str]
    solution: list[str]
    explanation: str = ""


class CodeStep(_StepBase):
    type: Literal["code"] = "code"
    prompt: str
    mode: Literal["io", "unit"] = "io"
    starter: str = ""
    signature: str | None = None
    fixtures: list[Fixture] = Field(default_factory=list)
    tests: list[TestCase] = Field(default_factory=list)
    hints: list[str] = Field(default_factory=list)
    solution: str = ""
    explanation: str = ""


class DebugStep(_StepBase):
    type: Literal["debug"] = "debug"
    prompt: str
    mode: Literal["io", "unit"] = "io"
    broken: str = ""
    fixtures: list[Fixture] = Field(default_factory=list)
    tests: list[TestCase] = Field(default_factory=list)
    hints: list[str] = Field(default_factory=list)
    solution: str = ""
    explanation: str = ""


class OpenStep(_StepBase):
    type: Literal["open"] = "open"
    prompt: str
    rubric: list[str] = Field(default_factory=list)
    min_words: int = 15


Step = Annotated[
    TheoryStep | QuizStep | PredictStep | BlankStep | ParsonsStep | CodeStep | DebugStep | OpenStep,
    Field(discriminator="type"),
]


class Lesson(BaseModel):
    id: str
    module: str
    title: str
    goal: str = ""
    minutes: int = 8
    order: int
    concepts: list[str] = Field(default_factory=list)
    steps: list[Step]
