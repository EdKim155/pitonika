import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import type { GradeResponse, Step } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { StepFrame } from './StepFrame'

export function BlankStep({
  step,
  result,
  submitting,
  submit,
}: {
  step: Step
  result: GradeResponse | null
  submitting: boolean
  submit: (payload: { answers: string[] }) => void
}) {
  const blanks = step.blanks || []
  const [answers, setAnswers] = useState<string[]>(() => blanks.map(() => ''))
  const passed = result?.passed ?? false
  const correct = (result?.correctAnswers || []).map(String)

  const parts = useMemo(() => (step.template || '').split(/(\{\{\d+\}\})/g), [step.template])

  const setAnswer = (index: number, value: string) => {
    setAnswers((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)))
  }

  return (
    <StepFrame
      label="Заполни пропуски"
      title={step.title}
      footer={
        <Button
          onClick={() => submit({ answers })}
          loading={submitting}
          disabled={passed || answers.some((item) => !item.trim())}
          size="lg"
        >
          Проверить
        </Button>
      }
    >
      {step.prompt && <p className="mb-3 text-[14px] leading-relaxed text-ink-soft">{step.prompt}</p>}
      <div className="rounded-2xl border border-line bg-[#0f1a16] p-4 text-[#e6efe9]">
        <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[13px] leading-8">
          {parts.map((part, index) => {
            const match = part.match(/^\{\{(\d+)\}\}$/)
            if (!match) return <span key={index}>{part}</span>
            const blankIndex = Number(match[1]) - 1
            const value = answers[blankIndex] ?? ''
            const isCorrect = passed && correct[blankIndex] === value.trim()
            return (
              <input
                key={index}
                value={value}
                onChange={(event) => setAnswer(blankIndex, event.target.value)}
                disabled={passed}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-label={`Пропуск ${blankIndex + 1}`}
                placeholder={blanks[blankIndex]?.hint || '…'}
                style={{ width: `${Math.max(9, value.length + 2)}ch` }}
                className={cn(
                  'mx-0.5 inline-block rounded-md border-b-2 bg-white/10 px-1.5 py-0.5 text-center font-mono text-[12.5px] text-white outline-none transition placeholder:text-white/30',
                  isCorrect ? 'border-emerald-400' : 'border-emerald-500/70 focus:border-emerald-300',
                )}
              />
            )
          })}
        </pre>
      </div>
      {passed && (
        <div className="mt-3 space-y-1">
          {correct.map((answer, index) => (
            <p key={index} className="flex items-center gap-1.5 text-[12px] text-muted">
              <Check className="size-3.5 text-primary-strong" />
              Пропуск {index + 1}: <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px] text-ink">{answer}</code>
            </p>
          ))}
        </div>
      )}
    </StepFrame>
  )
}
