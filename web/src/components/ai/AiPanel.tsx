import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bot, Lightbulb, MessagesSquare, Send, Sparkles, Square, TriangleAlert, Wand2, X } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { streamChat } from '@/lib/sse'
import { cn } from '@/lib/utils'
import { useUI } from '@/store/ui'
import { Markdown } from '@/components/ui/Markdown'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
}

let messageId = 1

const QUICK = [
  { id: 'hint', label: 'Подсказка', icon: Lightbulb },
  { id: 'error', label: 'Почему ошибка?', icon: TriangleAlert },
  { id: 'review', label: 'Разбери код', icon: MessagesSquare },
  { id: 'plan', label: 'Что дальше?', icon: Wand2 },
] as const

export function AiPanel() {
  const setAiOpen = useUI((state) => state.setAiOpen)
  const context = useUI((state) => state.aiContext)
  const toast = useToast((state) => state.push)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: 'assistant',
      content:
        'Привет! Я наставник Питоники. Помогу разобраться с заданием, не выдавая готовый ответ. Спроси что угодно или выбери быстродействие ниже.',
    },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [hintLevel, setHintLevel] = useState(1)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { data: status } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api.get<{ configured: boolean; provider?: string; model?: string; ok?: boolean; detected?: { provider: string; models: string[] } | null }>('/api/ai/status'),
    staleTime: 30_000,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  useEffect(() => {
    setHintLevel(1)
  }, [context.stepId])

  const online = Boolean(status?.configured && status?.ok)

  const append = (role: Message['role'], content: string, pending = false) => {
    const id = messageId++
    setMessages((current) => [...current, { id, role, content, pending }])
    return id
  }

  const patch = (id: number, content: string, pending = false) => {
    setMessages((current) => current.map((item) => (item.id === id ? { ...item, content, pending } : item)))
  }

  const stop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setBusy(false)
  }

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setInput('')
    append('user', trimmed)
    const id = append('assistant', '', true)
    setBusy(true)
    const controller = new AbortController()
    abortRef.current = controller
    let acc = ''
    try {
      await streamChat(
        {
          lessonId: context.lessonId,
          stepId: context.stepId,
          code: context.code,
          messages: [
            ...messages
              .filter((item) => item.id !== 0 && !item.pending)
              .slice(-8)
              .map((item) => ({ role: item.role, content: item.content })),
            { role: 'user', content: trimmed },
          ],
        },
        {
          onDelta: (delta) => {
            acc += delta
            patch(id, acc, true)
          },
          onReplace: (replacement) => {
            acc = replacement
            patch(id, replacement, true)
          },
          onError: (error) => {
            patch(id, `Не получилось: ${error}`, false)
          },
          onDone: () => {
            if (acc) patch(id, acc, false)
            setBusy(false)
          },
        },
        controller.signal,
      )
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        patch(id, 'Не удалось связаться с наставником. Проверь настройки.', false)
      }
      setBusy(false)
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }

  const runQuick = async (id: (typeof QUICK)[number]['id']) => {
    if (busy) return
    try {
      if (id === 'hint') {
        if (!context.stepId) {
          toast({ tone: 'info', title: 'Открой урок', description: 'Подсказки привязаны к текущему заданию.' })
          return
        }
        append('user', `Подсказка уровня ${hintLevel}`)
        const pendingId = append('assistant', '', true)
        setBusy(true)
        const data = await api.post<{ hint: string; level: number; source: string }>('/api/ai/hint', {
          stepId: context.stepId,
          level: hintLevel,
          code: context.code,
        })
        patch(pendingId, data.hint, false)
        setHintLevel((level) => Math.min(3, level + 1))
        setBusy(false)
        return
      }
      if (id === 'error') {
        if (!context.code || !context.code.trim()) {
          toast({ tone: 'info', title: 'Сначала запусти код', description: 'Наставник разберёт реальную ошибку.' })
          return
        }
        append('user', 'Объясни ошибку')
        const pendingId = append('assistant', '', true)
        setBusy(true)
        const data = await api.post<{ explanation: string }>('/api/ai/explain-error', {
          stepId: context.stepId,
          code: context.code,
          stderr: context.stderr || 'Ошибка не передана — объясни типичные причины.',
        })
        patch(pendingId, data.explanation, false)
        setBusy(false)
        return
      }
      if (id === 'review') {
        if (!context.code || context.code.trim().length < 10) {
          toast({ tone: 'info', title: 'Пока нечего разбирать', description: 'Напиши решение в редакторе.' })
          return
        }
        append('user', 'Разбери мой код')
        const pendingId = append('assistant', '', true)
        setBusy(true)
        const data = await api.post<{ review: string }>('/api/ai/review-code', {
          stepId: context.stepId,
          code: context.code,
        })
        patch(pendingId, data.review, false)
        setBusy(false)
        return
      }
      if (id === 'plan') {
        append('user', 'Что дальше?')
        const pendingId = append('assistant', '', true)
        setBusy(true)
        const data = await api.post<{ plan: string[] }>('/api/ai/plan', {})
        patch(pendingId, data.plan.map((item, index) => `${index + 1}. ${item}`).join('\n'), false)
        setBusy(false)
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Что-то пошло не так'
      toast({ tone: 'error', title: 'Наставник недоступен', description: message })
      setBusy(false)
    }
  }

  const statusLabel = useMemo(() => {
    if (!status) return 'Проверяю связь…'
    if (status.configured && status.ok) return `${status.model || status.provider} · онлайн`
    if (status.configured && !status.ok) return 'Провайдер не отвечает'
    if (status.detected) return `Найден ${status.detected.provider} — включи в настройках`
    return 'Офлайн-режим: авторские подсказки'
  }, [status])

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-[#08120e]/30 backdrop-blur-[1px] xl:hidden"
        onClick={() => setAiOpen(false)}
        aria-hidden
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface shadow-lift sm:w-[400px]">
        <header className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold leading-tight">Наставник</p>
            <p className="truncate text-[11px] text-muted">{statusLabel}</p>
          </div>
          <span
            className={cn('size-2 rounded-full', online ? 'bg-primary' : 'bg-line-strong')}
            title={online ? 'ИИ подключён' : 'Офлайн-подсказки'}
          />
          <button
            onClick={() => setAiOpen(false)}
            className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink"
            aria-label="Закрыть наставника"
          >
            <X className="size-4" />
          </button>
        </header>

        {context.title && (
          <div className="border-b border-line bg-surface-2/50 px-4 py-2 text-[11.5px] text-muted">
            Контекст: <span className="font-medium text-ink-soft">{context.title}</span>
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn('flex gap-2', message.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {message.role === 'assistant' && (
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
                  <Bot className="size-3.5" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[86%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
                  message.role === 'user'
                    ? 'rounded-br-md bg-primary text-on-primary'
                    : 'rounded-bl-md border border-line bg-paper text-ink-soft',
                )}
              >
                {message.role === 'assistant' ? (
                  message.pending && !message.content ? (
                    <Spinner className="size-4" />
                  ) : (
                    <Markdown className="prose-pitonika text-[13px] leading-relaxed">{message.content}</Markdown>
                  )
                ) : (
                  message.content
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-line p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK.map((chip) => {
              const Icon = chip.icon
              return (
                <button
                  key={chip.id}
                  onClick={() => runQuick(chip.id)}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1.5 text-[11.5px] font-medium text-ink-soft transition hover:border-primary/40 hover:text-primary-strong disabled:opacity-50"
                >
                  <Icon className="size-3.5" />
                  {chip.label}
                  {chip.id === 'hint' && <span className="text-[10px] text-muted">{hintLevel}/3</span>}
                </button>
              )
            })}
          </div>
          <div className="flex items-end gap-2 rounded-2xl border border-line bg-paper p-2 focus-within:border-primary/50">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void send(input)
                }
              }}
              rows={1}
              placeholder={context.stepId ? 'Спроси про это задание…' : 'Спроси что-нибудь о Python…'}
              className="max-h-28 min-h-8 flex-1 resize-none bg-transparent px-2 py-1 text-[13px] outline-none placeholder:text-muted/70"
            />
            {busy ? (
              <button
                onClick={stop}
                className="flex size-8 items-center justify-center rounded-xl bg-surface-2 text-ink-soft transition hover:bg-line"
                aria-label="Остановить"
              >
                <Square className="size-3.5" />
              </button>
            ) : (
              <button
                onClick={() => void send(input)}
                disabled={!input.trim()}
                className="flex size-8 items-center justify-center rounded-xl bg-primary text-on-primary transition hover:bg-primary-strong disabled:opacity-40"
                aria-label="Отправить"
              >
                <Send className="size-3.5" />
              </button>
            )}
          </div>
          {!online && (
            <p className="mt-2 text-[10.5px] leading-snug text-muted">
              Без подключённой модели работают авторские подсказки. Настроить ИИ можно в разделе «Настройки → Наставник».
            </p>
          )}
        </div>
      </aside>
    </>
  )
}
