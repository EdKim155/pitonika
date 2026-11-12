import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, Save, Terminal, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { RunResponse } from '@/lib/types'
import { Page, PageHeader } from '@/components/layout/Page'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PythonEditor } from '@/components/lesson/PythonEditor'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

const DEFAULT_CODE = `# Песочница Питоники
# Пиши любой код и запускай его — это твой личный Python.

name = "мир"
print(f"Привет, {name}!")

for number in range(1, 4):
    print(number, "в квадрате =", number ** 2)
`

export function PlaygroundPage() {
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const toast = useToast((state) => state.push)

  const initialCode = useMemo(() => {
    const fromQuery = searchParams.get('code')
    if (fromQuery) {
      try {
        return decodeURIComponent(fromQuery)
      } catch {
        return fromQuery
      }
    }
    return localStorage.getItem('pitonika:playground') || DEFAULT_CODE
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [code, setCode] = useState(initialCode)
  const [stdin, setStdin] = useState('')
  const [run, setRun] = useState<RunResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [title, setTitle] = useState('')

  const { data: snippets, isLoading } = useQuery({
    queryKey: ['snippets'],
    queryFn: () => api.get<{ snippets: { id: number; title: string; code: string; updatedAt: string }[] }>('/api/snippets'),
  })

  useEffect(() => {
    const timer = window.setTimeout(() => localStorage.setItem('pitonika:playground', code), 400)
    return () => window.clearTimeout(timer)
  }, [code])

  const runCode = async () => {
    setRunning(true)
    try {
      setRun(await api.post<RunResponse>('/api/run', { code, stdin }))
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

  const saveSnippet = async () => {
    if (!code.trim()) return
    try {
      await api.post('/api/snippets', { title: title.trim() || 'Сниппет', code })
      setTitle('')
      await queryClient.invalidateQueries({ queryKey: ['snippets'] })
      toast({ tone: 'success', title: 'Сниппет сохранён' })
    } catch (error) {
      toast({ tone: 'error', title: 'Не удалось сохранить', description: (error as Error).message })
    }
  }

  const removeSnippet = async (id: number) => {
    try {
      await api.del(`/api/snippets/${id}`)
      await queryClient.invalidateQueries({ queryKey: ['snippets'] })
    } catch (error) {
      toast({ tone: 'error', title: 'Не удалось удалить', description: (error as Error).message })
    }
  }

  return (
    <Page width="wide">
      <PageHeader
        eyebrow="Свободный режим"
        title="Песочница"
        description="Личный редактор для экспериментов. Код выполняется локально с таймаутом и лимитом вывода."
        action={
          <Button onClick={runCode} loading={running}>
            <Play className="size-4" />
            Запустить
            <span className="ml-1 hidden rounded border border-white/25 px-1 font-mono text-[10px] opacity-70 sm:inline">⌘↵</span>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-3">
          <PythonEditor value={code} onChange={setCode} onRun={runCode} height={380} />

          <div className="rounded-2xl border border-line bg-surface p-3">
            <div className="flex items-center gap-2">
              <Terminal className="size-3.5 text-muted" />
              <span className="text-[11.5px] font-medium uppercase tracking-wide text-muted">Тестовый ввод (stdin)</span>
            </div>
            <textarea
              value={stdin}
              onChange={(event) => setStdin(event.target.value)}
              rows={3}
              placeholder="Если программа использует input(), заполни ввод здесь"
              className="mt-2 w-full resize-y rounded-xl border border-line bg-paper p-2.5 font-mono text-[12px] outline-none focus:border-primary"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-[#0f1a16]">
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[11px] text-white/60">
              <Terminal className="size-3.5" />
              Вывод
              {run && (
                <span className={cn('ml-auto', run.timedOut ? 'text-amber-300' : run.stderr ? 'text-rose-300' : 'text-emerald-300')}>
                  {run.timedOut ? 'таймаут' : run.stderr ? `ошибка · ${run.exitCode}` : 'успешно'} · {run.durationMs} мс
                </span>
              )}
            </div>
            <pre className="max-h-64 min-h-24 overflow-auto p-3.5 font-mono text-[12.5px] leading-relaxed text-[#d7e5dd]">
              {run ? `${run.stdout}${run.stderr ? `\n${run.stderr}` : ''}${run.truncated ? '\n… вывод обрезан' : ''}` : 'Нажми «Запустить», чтобы увидеть результат'}
            </pre>
          </div>
        </div>

        <div className="space-y-3">
          <Card className="p-4">
            <h2 className="text-[13px] font-semibold">Сохранить сниппет</h2>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Название"
              className="mt-2 h-9 w-full rounded-lg border border-line bg-paper px-1.5 text-[12.5px] outline-none focus:border-primary"
            />
            <Button variant="secondary" size="sm" className="mt-2 w-full" onClick={saveSnippet}>
              <Save className="size-3.5" />
              Сохранить
            </Button>
          </Card>

          <Card className="p-4">
            <h2 className="text-[13px] font-semibold">Мои сниппеты</h2>
            {isLoading ? (
              <Spinner className="mt-3 size-4" />
            ) : !snippets?.snippets.length ? (
              <p className="mt-2 text-[11.5px] leading-snug text-muted">Здесь появятся сохранённые фрагменты кода.</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {snippets.snippets.map((snippet) => (
                  <div key={snippet.id} className="group flex items-center gap-1.5 rounded-lg border border-line bg-surface-2/40 px-2 py-1.5">
                    <button
                      onClick={() => setCode(snippet.code)}
                      className="min-w-0 flex-1 truncate text-left text-[12px] font-medium hover:text-primary-strong"
                      title={snippet.title}
                    >
                      {snippet.title}
                    </button>
                    <button
                      onClick={() => removeSnippet(snippet.id)}
                      className="rounded p-1 text-muted opacity-0 transition hover:bg-surface hover:text-danger group-hover:opacity-100"
                      aria-label="Удалить"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="rounded-2xl border border-info/25 bg-info-soft/50 p-3.5 text-[11.5px] leading-relaxed text-info">
            <p className="font-semibold">Безопасность</p>
            <p className="mt-1">
              Код исполняется от твоего пользователя. Для чужих программ включи строгий режим Docker в настройках.
            </p>
          </div>
        </div>
      </div>
    </Page>
  )
}
