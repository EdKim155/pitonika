import { useState } from 'react'
import { ArrowDown, ArrowUp, RotateCcw, X } from 'lucide-react'
import type { GradeResponse, Step } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { StepFrame } from './StepFrame'

export function ParsonsStep({
  step,
  result,
  submitting,
  submit,
}: {
  step: Step
  result: GradeResponse | null
  submitting: boolean
  submit: (payload: { order: string[] }) => void
}) {
  const lines = step.lines || []
  const [picked, setPicked] = useState<number[]>([])
  const passed = result?.passed ?? false

  const add = (index: number) => {
    if (passed) return
    setPicked((current) => [...current, index])
  }

  const removeAt = (position: number) => {
    if (passed) return
    setPicked((current) => current.filter((_, index) => index !== position))
  }

  const move = (position: number, direction: -1 | 1) => {
    if (passed) return
    setPicked((current) => {
      const next = [...current]
      const target = position + direction
      if (target < 0 || target >= next.length) return current
      ;[next[position], next[target]] = [next[target], next[position]]
      return next
    })
  }

  const available = lines.map((_, index) => index).filter((index) => !picked.includes(index))

  return (
    <StepFrame
      label="Собери программу"
      title={step.title}
      footer={
        <div className="flex w-full items-center gap-2">
          <Button
            onClick={() => submit({ order: picked.map((index) => lines[index]) })}
            loading={submitting}
            disabled={picked.length === 0 || passed}
            size="lg"
          >
            Проверить
          </Button>
          <Button variant="ghost" onClick={() => setPicked([])} disabled={passed || picked.length === 0}>
            <RotateCcw className="size-4" />
            Очистить
          </Button>
          <span className="ml-auto text-[11.5px] text-muted">
            {picked.length} / {lines.length} строк
          </span>
        </div>
      }
    >
      {step.prompt && <p className="mb-3 text-[14px] leading-relaxed text-ink-soft">{step.prompt}</p>}

      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted">Откуда выбирать</p>
          <div className="space-y-1.5">
            {available.map((index) => (
              <button
                key={index}
                onClick={() => add(index)}
                disabled={passed}
                className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left transition hover:border-primary/40 hover:bg-primary-soft/30 disabled:opacity-50"
              >
                <span className="font-mono text-[12px] text-ink-soft">{lines[index].replace(/\n/g, '⏎') || ' '}</span>
              </button>
            ))}
            {available.length === 0 && (
              <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[12px] text-muted">
                Все строки использованы
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted">Твоя программа</p>
          <div className="min-h-24 rounded-2xl border border-line bg-surface-2/40 p-2">
            {picked.length === 0 && (
              <p className="px-2 py-6 text-center text-[12px] text-muted">Нажимай на строки слева, чтобы добавить их сюда</p>
            )}
            <div className="space-y-1">
              {picked.map((lineIndex, position) => (
                <div
                  key={`${lineIndex}-${position}`}
                  className={cn(
                    'group flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5',
                    passed && 'border-primary/30 bg-primary-soft/40',
                  )}
                >
                  <span className="w-4 shrink-0 text-right font-mono text-[10px] text-muted">{position + 1}</span>
                  <span className="min-w-0 flex-1 whitespace-pre font-mono text-[12px] text-ink-soft">
                    {lines[lineIndex] || ' '}
                  </span>
                  {!passed && (
                    <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                      <button onClick={() => move(position, -1)} className="rounded p-1 text-muted hover:bg-surface-2" aria-label="Выше">
                        <ArrowUp className="size-3" />
                      </button>
                      <button onClick={() => move(position, 1)} className="rounded p-1 text-muted hover:bg-surface-2" aria-label="Ниже">
                        <ArrowDown className="size-3" />
                      </button>
                      <button onClick={() => removeAt(position)} className="rounded p-1 text-muted hover:bg-surface-2" aria-label="Убрать">
                        <X className="size-3" />
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </StepFrame>
  )
}
