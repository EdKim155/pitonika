import { useState } from 'react'
import { Send } from 'lucide-react'
import type { GradeResponse, Step } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Markdown } from '@/components/ui/Markdown'
import { StepFrame } from './StepFrame'

export function OpenStep({
  step,
  result,
  submitting,
  submit,
}: {
  step: Step
  result: GradeResponse | null
  submitting: boolean
  submit: (payload: { text: string }) => void
}) {
  const [text, setText] = useState('')
  const passed = result?.passed ?? false
  const words = text.trim() ? text.trim().split(/\s+/).length : 0

  return (
    <StepFrame
      label="Свободный ответ"
      title={step.title}
      footer={
        <div className="flex w-full items-center gap-2">
          <Button onClick={() => submit({ text })} loading={submitting} disabled={passed || words === 0} size="lg">
            <Send className="size-3.5" />
            Отправить
          </Button>
          <span className="ml-auto text-[11.5px] text-muted">
            {words} / {step.minWords || 15} слов
          </span>
        </div>
      }
    >
      <Markdown className="prose-pitonika text-[13.5px]">{step.prompt || ''}</Markdown>
      {step.rubric && step.rubric.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-xl border border-line bg-surface-2/50 px-4 py-3">
          {step.rubric.map((item, index) => (
            <li key={index} className="flex gap-2 text-[12.5px] text-ink-soft">
              <span className="text-primary-strong">•</span>
              {item}
            </li>
          ))}
        </ul>
      )}
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={passed}
        rows={6}
        placeholder="Напиши ответ своими словами…"
        className="mt-3 w-full rounded-2xl border border-line bg-paper p-3.5 text-[13.5px] leading-relaxed outline-none transition focus:border-primary"
      />
    </StepFrame>
  )
}
