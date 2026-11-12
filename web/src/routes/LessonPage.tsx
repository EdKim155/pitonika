import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, Lightbulb, RotateCcw, Sparkles, X } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { Bootstrap, GradeResponse, LessonCompleteResponse, LessonPayload, Step } from '@/lib/types'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { useToast } from '@/components/ui/Toast'
import { useUI } from '@/store/ui'
import { cn, plural } from '@/lib/utils'
import { TheoryStep } from '@/components/steps/TheoryStep'
import { ChoiceStep } from '@/components/steps/ChoiceStep'
import { BlankStep } from '@/components/steps/BlankStep'
import { ParsonsStep } from '@/components/steps/ParsonsStep'
import { CodeStep } from '@/components/steps/CodeStep'
import { OpenStep } from '@/components/steps/OpenStep'
import type { SubmitPayload } from '@/components/steps/types'
import { ResultPanel } from '@/components/lesson/ResultPanel'
import { LessonComplete } from '@/components/lesson/LessonComplete'

export function LessonPage() {
  const { lessonId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const data = useOutletContext<Bootstrap>()
  const toast = useToast((state) => state.push)
  const setAiContext = useUI((state) => state.setAiContext)

  const { data: lesson, isLoading, error } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => api.get<LessonPayload>(`/api/content/lesson/${lessonId}`),
    staleTime: 5_000,
  })

  const [index, setIndex] = useState<number | null>(null)
  const [result, setResult] = useState<GradeResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [completed, setCompleted] = useState<LessonCompleteResponse | null>(null)
  const [revealOpen, setRevealOpen] = useState(false)
  const [solution, setSolution] = useState<string | null>(null)
  const [replay, setReplay] = useState(false)
  const startedAt = useRef(Date.now())
  const resultRef = useRef<HTMLDivElement>(null)
  const stepsRef = useRef<Step[]>([])
  const lessonTitleRef = useRef<string>('')

  const steps = lesson?.steps ?? []
  const step: Step | undefined = index === null ? undefined : steps[index]

  stepsRef.current = steps
  lessonTitleRef.current = lesson?.title || ''

  useEffect(() => {
    if (!lesson || index !== null) return
    const requested = searchParams.get('step')
    if (requested) {
      const position = lesson.steps.findIndex((item) => item.id === requested)
      if (position >= 0) {
        setIndex(position)
        return
      }
    }
    const firstPending = lesson.steps.findIndex((item) => item.state?.status !== 'done')
    setIndex(firstPending >= 0 ? firstPending : 0)
  }, [lesson, index, searchParams])

  useEffect(() => {
    setResult(null)
    setHintsUsed(0)
    setAttempts(0)
    setRevealed(false)
    startedAt.current = Date.now()
    const current = stepsRef.current[index ?? 0]
    if (current) {
      setAiContext({ lessonId, stepId: current.id, code: current.starter, title: current.title || lessonTitleRef.current })
    }
    // сброс состояния только при переходе между шагами
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, lessonId])

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [result])

  const allDone = useMemo(() => steps.length > 0 && steps.every((item) => item.state?.status === 'done'), [steps])

  const nextLesson = useMemo(() => {
    const flat = data.path.flatMap((module) => module.lessons)
    const position = flat.findIndex((item) => item.id === lessonId)
    if (position < 0) return null
    return flat.slice(position + 1).find((item) => item.status !== 'locked') ?? null
  }, [data.path, lessonId])

  const finish = async () => {
    try {
      const response = await api.post<LessonCompleteResponse>(`/api/lesson/${lessonId}/complete`)
      setCompleted(response)
      for (const achievement of response.achievements) {
        toast({ tone: 'achievement', title: achievement.title, description: achievement.description })
      }
      await queryClient.invalidateQueries({ queryKey: ['bootstrap'] })
      await queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] })
    } catch (err) {
      toast({ tone: 'error', title: 'Не удалось завершить урок', description: (err as Error).message })
    }
  }

  const submit = async (payload: SubmitPayload) => {
    if (!step) return
    setSubmitting(true)
    try {
      const durationMs = Math.min(120_000, Date.now() - startedAt.current)
      const response =
        step.type === 'theory'
          ? await api.post<GradeResponse>('/api/step/complete', { stepId: step.id, durationMs })
          : await api.post<GradeResponse>('/api/grade', {
              stepId: step.id,
              code: payload.code,
              stdin: payload.stdin,
              answers: payload.answers,
              answer: payload.answer,
              order: payload.order,
              text: payload.text,
              hintsUsed,
              revealed,
              durationMs,
            })

      setResult(response)
      if (!response.passed) setAttempts((value) => value + 1)
      if (response.xpGained > 0) {
        toast({ tone: 'success', title: `+${response.xpGained} XP`, description: response.firstTry ? 'С первой попытки!' : undefined })
      }
      for (const achievement of response.achievements) {
        toast({ tone: 'achievement', title: achievement.title, description: achievement.description })
      }
      if (response.level.level > data.profile.level.level) {
        toast({ tone: 'achievement', title: `Уровень ${response.level.level}!`, description: response.level.title })
      }
      await queryClient.invalidateQueries({ queryKey: ['bootstrap'] })
      await queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Проверка не удалась'
      toast({ tone: 'error', title: 'Ошибка проверки', description: message })
    } finally {
      setSubmitting(false)
    }
  }

  const next = () => {
    if (index === null) return
    setIndex(Math.min(steps.length - 1, index + 1))
    setResult(null)
  }

  const reveal = async () => {
    if (!step) return
    try {
      const response = await api.post<{ solution: string }>(`/api/step/${step.id}/reveal`)
      setSolution(response.solution)
      setRevealed(true)
      setRevealOpen(true)
    } catch (err) {
      toast({ tone: 'error', title: 'Решение недоступно', description: (err as Error).message })
    }
  }

  if (isLoading || index === null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (error || !lesson || !step) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-[15px] font-semibold">Урок не найден</p>
        <p className="mt-1 text-[13px] text-muted">Возможно, ссылка устарела.</p>
        <Link to="/path" className="mt-4 inline-block text-[13px] font-medium text-primary-strong underline">
          Вернуться к пути
        </Link>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <LessonComplete
          lesson={lesson}
          result={completed}
          hasNext={Boolean(nextLesson)}
          onNextLesson={() => (nextLesson ? navigate(`/lesson/${nextLesson.id}`) : navigate('/path'))}
          onBackToPath={() => navigate('/path')}
        />
      </div>
    )
  }

  if (allDone && !replay && !result) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 md:px-8">
        <div className="rounded-3xl border border-primary/25 bg-surface p-7 text-center shadow-soft">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary-strong">
            <Check className="size-7" />
          </div>
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight">Этот урок уже пройден</h1>
          <p className="mt-1.5 text-[13.5px] text-muted">
            {lesson.title} · {steps.length} {plural(steps.length, 'шаг', 'шага', 'шагов')}
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={() => navigate('/path')} size="lg">
              К карте пути
              <ArrowRight className="size-4" />
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setReplay(true)
                setIndex(0)
                setCompleted(null)
              }}
            >
              <RotateCcw className="size-4" />
              Повторить урок
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const currentHints = step.hints || []
  const canReveal = (step.type === 'code' || step.type === 'debug') && attempts >= 2 && !result?.passed
  const isLast = index === steps.length - 1
  const progress = ((index + (result?.passed ? 1 : 0)) / steps.length) * 100

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-4 md:px-8 md:py-6">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/path')}
          className="rounded-xl border border-line bg-surface p-2 text-muted transition hover:text-ink"
          aria-label="Выйти из урока"
        >
          <X className="size-4" />
        </button>
        <div className="flex-1">
          <div className="flex gap-1">
            {steps.map((item, position) => (
              <div
                key={item.id}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  position < index || (position === index && result?.passed)
                    ? 'bg-primary'
                    : position === index
                      ? 'bg-primary/40'
                      : 'bg-line',
                )}
              />
            ))}
          </div>
        </div>
        <span className="text-[11.5px] font-medium tabular-nums text-muted">
          {index + 1}/{steps.length}
        </span>
        {currentHints.length > 0 && (
          <button
            onClick={() => setHintsUsed((value) => Math.min(currentHints.length, value + 1))}
            disabled={hintsUsed >= currentHints.length}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 py-2 text-[12px] font-medium text-ink-soft transition hover:border-accent/50 hover:text-ink disabled:opacity-50"
          >
            <Lightbulb className="size-3.5 text-accent" />
            {hintsUsed}/{currentHints.length}
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="primary">{lesson.module?.title || 'Урок'}</Badge>
        <span className="text-[12px] text-muted">{lesson.title}</span>
        {step.concepts.length > 0 && (
          <span className="ml-auto hidden items-center gap-1 text-[11px] text-muted sm:flex">
            <Sparkles className="size-3" />
            {step.concepts.slice(0, 2).join(' · ')}
          </span>
        )}
      </div>

      {hintsUsed > 0 && currentHints.length > 0 && (
        <div className="animate-float-up mb-3 rounded-2xl border border-accent/35 bg-accent-soft/50 p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#7a5a00] dark:text-accent">
            <Lightbulb className="size-3.5" /> Подсказки
          </p>
          <div className="mt-1.5 space-y-1.5">
            {currentHints.slice(0, hintsUsed).map((hint, position) => (
              <p key={position} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-soft">
                <span className="font-semibold text-[#7a5a00] dark:text-accent">{position + 1}.</span>
                {hint}
              </p>
            ))}
          </div>
        </div>
      )}

      {step.type === 'theory' && (
        <TheoryStep step={step} result={result} submitting={submitting} submit={() => void submit({})} />
      )}
      {step.type === 'quiz' && (
        <ChoiceStep step={step} result={result} submitting={submitting} submit={(payload) => void submit(payload)} />
      )}
      {step.type === 'predict' && (
        <ChoiceStep step={step} result={result} submitting={submitting} submit={(payload) => void submit(payload)} />
      )}
      {step.type === 'blank' && (
        <BlankStep step={step} result={result} submitting={submitting} submit={(payload) => void submit(payload)} />
      )}
      {step.type === 'parsons' && (
        <ParsonsStep step={step} result={result} submitting={submitting} submit={(payload) => void submit(payload)} />
      )}
      {(step.type === 'code' || step.type === 'debug') && (
        <CodeStep step={step} result={result} submitting={submitting} submit={(payload) => void submit(payload)} />
      )}
      {step.type === 'open' && (
        <OpenStep step={step} result={result} submitting={submitting} submit={(payload) => void submit(payload)} />
      )}

      {result && (
        <div ref={resultRef}>
          <ResultPanel
          result={result}
          step={step}
          onNext={next}
          onRetry={() => setResult(null)}
          onReveal={canReveal ? reveal : undefined}
          canReveal={canReveal}
          isLast={isLast}
            onFinish={() => void finish()}
          />
        </div>
      )}

      {!result && step.type !== 'theory' && (
        <p className="mt-4 text-center text-[11.5px] text-muted">
          Выполни задание и нажми «Проверить» — прогресс сохраняется автоматически
        </p>
      )}

      <Modal open={revealOpen} onClose={() => setRevealOpen(false)} title="Эталонное решение">
        <p className="mb-3 text-[12.5px] leading-relaxed text-muted">
          Подсматривать — нормально, но попробуй сначала сам. Шаг будет засчитан с пониженным баллом (60%).
        </p>
        {solution && <CodeBlock code={solution} showLineNumbers />}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRevealOpen(false)}>
            Понятно
          </Button>
        </div>
      </Modal>

      <div className="mt-6 text-center">
        <span className="text-[10.5px] text-muted">Прогресс урока: {Math.round(progress)}%</span>
      </div>
    </div>
  )
}
