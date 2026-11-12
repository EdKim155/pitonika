import { useState } from 'react'
import {
  ArrowRight,
  Check,
  CircleAlert,
  CircleCheck,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { GradeResponse, Step } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { Markdown } from '@/components/ui/Markdown'
import { cn } from '@/lib/utils'
import { useUI } from '@/store/ui'

function DiffBlock({ expected, actual }: { expected: string; actual: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted">Ожидалось</p>
        <pre className="max-h-40 overflow-auto rounded-xl border border-line bg-surface-2 p-3 font-mono text-[12px] leading-relaxed text-ink-soft">
          {expected || '— (пусто)'}
        </pre>
      </div>
      <div>
        <p className="mb-1 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted">
          Вывод программы
        </p>
        <pre
          className={cn(
            'max-h-40 overflow-auto rounded-xl border p-3 font-mono text-[12px] leading-relaxed',
            expected === actual
              ? 'border-primary/30 bg-primary-soft/40 text-ink-soft'
              : 'border-danger/30 bg-danger-soft/40 text-ink-soft',
          )}
        >
          {actual || '— (пусто)'}
        </pre>
      </div>
    </div>
  )
}

export function ResultPanel({
  result,
  step,
  onNext,
  onRetry,
  onReveal,
  canReveal,
  isLast,
  onFinish,
}: {
  result: GradeResponse
  step: Step
  onNext: () => void
  onRetry: () => void
  onReveal?: () => void
  canReveal: boolean
  isLast: boolean
  onFinish: () => void
}) {
  const [explanation, setExplanation] = useState<string | null>(null)
  const [explaining, setExplaining] = useState(false)
  const setAiContext = useUI((state) => state.setAiContext)
  const setAiOpen = useUI((state) => state.setAiOpen)
  const details = result.details
  const passed = result.passed

  const askWhy = async () => {
    setExplaining(true)
    try {
      const data = await api.post<{ explanation: string }>('/api/ai/explain-error', {
        stepId: step.id,
        code: details.stdout || '',
        stderr: details.stderr || details.diagnosis || 'Объясни, почему это решение не прошло проверку.',
      })
      setExplanation(data.explanation)
    } catch (error) {
      setExplanation(error instanceof ApiError ? error.message : 'Не удалось получить объяснение')
    } finally {
      setExplaining(false)
    }
  }

  const showDiff = details.kind === 'io' && details.cases && details.cases.length > 0
  const failedCase = details.cases?.find((item) => !item.passed) ?? details.cases?.[0]

  return (
    <div
      className={cn(
        'animate-float-up mt-4 rounded-2xl border p-4 sm:p-5',
        passed ? 'border-primary/35 bg-primary-soft/40' : 'border-danger/30 bg-danger-soft/30',
      )}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div
          className={cn(
            'flex size-8 items-center justify-center rounded-full',
            passed ? 'bg-primary text-on-primary' : 'bg-danger text-white',
          )}
        >
          {passed ? <Check className="size-4" /> : <X className="size-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold">{passed ? 'Верно!' : 'Пока не то'}</p>
          <p className="text-[12px] text-muted">
            {passed
              ? result.xpGained > 0
                ? `+${result.xpGained} XP · ${Math.round(result.score * 100)}% за шаг`
                : `Шаг уже был пройден · ${Math.round(result.score * 100)}%`
              : details.diagnosis || 'Проверь условие и попробуй ещё раз.'}
          </p>
        </div>
        {passed && result.firstTry && <Badge tone="accent">с первой попытки</Badge>}
        {details.limitHit === 'timeout' || details.timedOut ? <Badge tone="danger">таймаут</Badge> : null}
      </div>

      {details.kind === 'unit' && details.tests && details.tests.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {details.tests.map((test, index) => (
            <div
              key={index}
              className={cn(
                'flex items-start gap-2 rounded-xl border px-3 py-2 text-[12px]',
                test.passed ? 'border-primary/25 bg-surface/70' : 'border-danger/25 bg-surface/70',
              )}
            >
              {test.passed ? (
                <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-primary-strong" />
              ) : (
                <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-danger" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{test.name}</p>
                {!test.passed && (
                  <p className="mt-0.5 text-muted">
                    {test.message || `Получено ${test.got || '—'}, ожидалось ${test.expected}`}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showDiff && failedCase && (
        <div className="mt-3">
          <DiffBlock expected={failedCase.expected} actual={failedCase.actual} />
          {failedCase.stderr && (
            <pre className="mt-2 max-h-32 overflow-auto rounded-xl border border-danger/20 bg-surface p-3 font-mono text-[11.5px] leading-relaxed text-danger">
              {failedCase.stderr}
            </pre>
          )}
        </div>
      )}

      {details.kind === 'io' && passed && failedCase && failedCase.expected && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface/70 px-3 py-2 text-[12px] text-muted">
          <Terminal className="size-3.5" />
          Вывод совпал для всех примеров: <span className="font-mono text-ink-soft">{failedCase.expected.split('\n')[0]}</span>
        </div>
      )}

      {details.kind === 'blank' && details.checks && (
        <div className="mt-3 space-y-1">
          {details.checks.map((check, index) => (
            <div key={index} className="flex items-center gap-2 text-[12px]">
              {check.passed ? <Check className="size-3.5 text-primary-strong" /> : <X className="size-3.5 text-danger" />}
              <span className="text-muted">пропуск {index + 1}:</span>
              <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11.5px]">{check.expected}</code>
              {check.hint && !check.passed && <span className="text-muted">— {check.hint}</span>}
            </div>
          ))}
        </div>
      )}

      {passed && result.correctAnswers && ['quiz', 'predict'].includes(details.kind) && (
        <p className="mt-3 text-[12px] text-muted">
          Правильный ответ: <span className="font-medium text-ink">{String(result.correctAnswers[0])}</span>
        </p>
      )}

      {!passed && result.correctAnswers && ['quiz', 'predict'].includes(details.kind) && (
        <p className="mt-3 text-[12px] text-muted">
          Правильный ответ: <span className="font-medium text-ink">{String(result.correctAnswers[0])}</span>
        </p>
      )}

      {passed && result.explanation && (
        <div className="mt-3 rounded-xl border border-line bg-surface/70 px-3.5 py-3">
          <p className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted">
            <Lightbulb className="size-3.5" /> Почему так
          </p>
          <Markdown className="prose-pitonika text-[12.5px] leading-relaxed">{result.explanation}</Markdown>
        </div>
      )}

      {explanation && (
        <div className="mt-3 rounded-xl border border-info/25 bg-info-soft/50 px-3.5 py-3">
          <p className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-info">
            <Sparkles className="size-3.5" /> Разбор от наставника
          </p>
          <Markdown className="prose-pitonika text-[12.5px] leading-relaxed">{explanation}</Markdown>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {passed ? (
          <Button onClick={isLast ? onFinish : onNext} size="md">
            {isLast ? 'Завершить урок' : 'Дальше'}
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <>
            <Button onClick={onRetry} variant="secondary" size="md">
              <RotateCcw className="size-4" />
              Попробовать снова
            </Button>
            <Button
              variant="ghost"
              size="md"
              loading={explaining}
              onClick={() => {
                setAiOpen(true)
                setAiContext({ stepId: step.id, code: details.stdout, stderr: details.stderr || details.diagnosis })
                void askWhy()
              }}
            >
              <Sparkles className="size-4" />
              Объяснить ошибку
            </Button>
            {canReveal && onReveal && (
              <button onClick={onReveal} className="ml-auto text-[12px] text-muted underline underline-offset-4 hover:text-ink">
                Показать решение
              </button>
            )}
          </>
        )}
        {passed && (
          <Button
            variant="ghost"
            size="md"
            className="ml-auto"
            onClick={() => {
              setAiOpen(true)
              setAiContext({ stepId: step.id })
            }}
          >
            <Sparkles className="size-4" />
            Спросить наставника
          </Button>
        )}
      </div>
    </div>
  )
}
