import { useState } from 'react'
import { Check } from 'lucide-react'
import type { GradeResponse, Step } from '@/lib/types'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { StepFrame } from './StepFrame'

export function ChoiceStep({
  step,
  result,
  submitting,
  submit,
}: {
  step: Step
  result: GradeResponse | null
  submitting: boolean
  submit: (payload: { answers: number[] } | { answer: number }) => void
}) {
  const isQuiz = step.type === 'quiz'
  const multi = Boolean(step.multiple)
  const [selected, setSelected] = useState<number[]>([])
  const passed = result?.passed ?? false
  const correct = result?.correctAnswers?.map((item) => Number(item)) ?? []

  const toggle = (index: number) => {
    if (passed) return
    if (multi) {
      setSelected((current) =>
        current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
      )
    } else {
      setSelected([index])
    }
  }

  const onCheck = () => {
    if (isQuiz) submit({ answers: selected })
    else submit({ answer: selected[0] ?? -1 })
  }

  return (
    <StepFrame
      label={isQuiz ? 'Вопрос' : 'Что выведет программа'}
      title={isQuiz ? step.question : step.title}
      footer={
        <div className="flex w-full items-center gap-2">
          <Button onClick={onCheck} loading={submitting} disabled={selected.length === 0 || passed} size="lg">
            Проверить
          </Button>
          {multi && <span className="text-[12px] text-muted">Можно выбрать несколько</span>}
        </div>
      }
    >
      {step.code && (
        <div className="mb-4">
          <CodeBlock code={step.code} showLineNumbers />
        </div>
      )}
      {!isQuiz && !step.code && step.title && <p className="mb-3 text-[14px] text-muted">{step.prompt}</p>}

      <div className="space-y-2" role={multi ? 'group' : 'radiogroup'}>
        {(step.options || []).map((option, index) => {
          const active = selected.includes(index)
          const isCorrect = passed && correct.includes(index)
          const isWrongChoice = passed && active && !correct.includes(index)
          return (
            <button
              key={index}
              onClick={() => toggle(index)}
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={active}
              className={cn(
                'flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition',
                isCorrect && 'border-primary/50 bg-primary-soft/60',
                isWrongChoice && 'border-danger/40 bg-danger-soft/40',
                !passed && active && 'border-primary/60 bg-primary-soft/50 shadow-sm',
                !passed && !active && 'border-line bg-surface hover:border-line-strong hover:bg-surface-2/50',
                passed && !isCorrect && 'border-line bg-surface opacity-70',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border text-[11.5px] font-bold',
                  active || isCorrect
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-line-strong bg-surface text-muted',
                )}
              >
                {isCorrect ? <Check className="size-3.5" /> : String.fromCharCode(65 + index)}
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed',
                  !isQuiz && 'font-mono text-[12.5px]',
                )}
              >
                {option}
              </span>
            </button>
          )
        })}
      </div>
    </StepFrame>
  )
}
