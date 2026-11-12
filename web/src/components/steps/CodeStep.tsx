import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, RotateCcw, Terminal } from 'lucide-react'
import { api } from '@/lib/api'
import type { GradeResponse, RunResponse, Step } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Markdown } from '@/components/ui/Markdown'
import { useUI } from '@/store/ui'
import { cn } from '@/lib/utils'
import { PythonEditor } from '@/components/lesson/PythonEditor'
import { StepFrame } from './StepFrame'

function draftKey(stepId: string) {
  return `pitonika:draft:${stepId}`
}

export function CodeStep({
  step,
  result,
  submitting,
  submit,
}: {
  step: Step
  result: GradeResponse | null
  submitting: boolean
  submit: (payload: { code: string }) => void
}) {
  const starter = step.starter || ''
  const [code, setCode] = useState(() => localStorage.getItem(draftKey(step.id)) ?? starter)
  const [run, setRun] = useState<RunResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [showConsole, setShowConsole] = useState(false)
  const passed = result?.passed ?? false
  const setAiContext = useUI((state) => state.setAiContext)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      localStorage.setItem(draftKey(step.id), code)
    }, 350)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [code, step.id])

  useEffect(() => {
    setAiContext({ stepId: step.id, code, title: step.title || 'Практика' })
  }, [code, step.id, step.title, setAiContext])

  const fixture = useMemo(() => (step.fixtures || [])[0], [step.fixtures])

  const runCode = async () => {
    setRunning(true)
    setShowConsole(true)
    try {
      const response = await api.post<RunResponse>('/api/run', { code, stdin: fixture?.stdin ?? '' })
      setRun(response)
    } catch (error) {
      setRun({
        stdout: '',
        stderr: (error as Error).message,
        exitCode: 1,
        timedOut: false,
        durationMs: 0,
        truncated: false,
        limitHit: null,
        runnerError: (error as Error).message,
      })
    } finally {
      setRunning(false)
    }
  }

  const reset = () => {
    setCode(starter)
    localStorage.removeItem(draftKey(step.id))
    setRun(null)
  }

  return (
    <StepFrame
      wide
      label={step.type === 'debug' ? 'Найди ошибку' : 'Практика'}
      title={step.title}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <Button onClick={() => submit({ code })} loading={submitting} disabled={passed || !code.trim()} size="lg">
            Проверить
          </Button>
          <Button variant="secondary" onClick={runCode} loading={running} disabled={!code.trim()}>
            <Play className="size-3.5" />
            Запустить
          </Button>
          <Button variant="ghost" onClick={reset} disabled={passed}>
            <RotateCcw className="size-3.5" />
            Сбросить
          </Button>
          <span className="ml-auto hidden items-center gap-1 text-[11px] text-muted sm:flex">
            <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px]">⌘↵</kbd>
            запуск
          </span>
        </div>
      }
    >
      <Markdown className="prose-pitonika text-[13.5px]">{step.prompt || ''}</Markdown>

      {fixture && (fixture.stdin || fixture.stdout) && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {fixture.stdin && (
            <div>
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted">Пример ввода</p>
              <pre className="rounded-xl border border-line bg-surface-2 p-2.5 font-mono text-[11.5px] text-ink-soft">{fixture.stdin}</pre>
            </div>
          )}
          {fixture.stdout && (
            <div>
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted">Ожидаемый вывод</p>
              <pre className="rounded-xl border border-line bg-surface-2 p-2.5 font-mono text-[11.5px] text-ink-soft">{fixture.stdout}</pre>
            </div>
          )}
        </div>
      )}

      {step.mode === 'unit' && step.signature && (
        <p className="mt-3 rounded-xl border border-info/25 bg-info-soft/50 px-3 py-2 font-mono text-[12px] text-info">
          {step.signature}
        </p>
      )}

      <div className="mt-3">
        <PythonEditor value={code} onChange={setCode} onRun={runCode} height={step.mode === 'unit' ? 260 : 300} readOnly={passed} />
      </div>

      {step.mode === 'unit' && step.testCount ? (
        <p className="mt-2 text-[11.5px] text-muted">
          Проверка запустит {step.testCount} скрытых тестов и покажет, что именно не совпало.
        </p>
      ) : null}

      {showConsole && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-[#0f1a16]">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[11px] text-white/60">
            <Terminal className="size-3.5" />
            Консоль
            {run && (
              <span className={cn('ml-auto', run.timedOut ? 'text-amber-300' : run.stderr ? 'text-rose-300' : 'text-emerald-300')}>
                {run.timedOut ? 'таймаут' : run.stderr ? `ошибка · код ${run.exitCode}` : 'успешно'} · {run.durationMs} мс
              </span>
            )}
            <button onClick={() => setShowConsole(false)} className="ml-2 text-white/40 hover:text-white">
              свернуть
            </button>
          </div>
          <pre className="max-h-52 overflow-auto p-3 font-mono text-[12px] leading-relaxed text-[#d7e5dd]">
            {run?.stdout || (!run?.stderr ? 'Вывод пуст' : '')}
            {run?.stderr ? `\n${run.stderr}` : ''}
            {run?.truncated ? '\n… вывод обрезан' : ''}
          </pre>
        </div>
      )}
    </StepFrame>
  )
}
