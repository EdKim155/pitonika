import { ArrowRight } from 'lucide-react'
import type { GradeResponse, Step } from '@/lib/types'
import { Markdown } from '@/components/ui/Markdown'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { Button } from '@/components/ui/Button'
import { StepFrame } from './StepFrame'

export function TheoryStep({
  step,
  result,
  submitting,
  submit,
}: {
  step: Step
  result: GradeResponse | null
  submitting: boolean
  submit: () => void
}) {
  return (
    <StepFrame
      label="Теория"
      title={step.title}
      footer={
        result?.passed ? null : (
          <Button onClick={submit} loading={submitting} size="lg">
            Понятно
            <ArrowRight className="size-4" />
          </Button>
        )
      }
    >
      <Markdown>{step.body || ''}</Markdown>
      {step.example && (
        <div className="mt-4">
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted">Пример</p>
          <CodeBlock code={step.example} />
        </div>
      )}
      {step.aside && (
        <div className="mt-4 rounded-xl border border-accent/35 bg-accent-soft/60 px-3.5 py-3 text-[12.5px] leading-relaxed text-[#7a5a00] dark:text-accent">
          {step.aside}
        </div>
      )}
    </StepFrame>
  )
}
