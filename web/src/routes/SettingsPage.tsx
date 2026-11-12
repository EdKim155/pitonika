import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Download,
  KeyRound,
  Monitor,
  Moon,
  RefreshCw,
  Save,
  Server,
  Sun,
  Terminal,
  Upload,
  User,
  Wand2,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { SettingsInfo } from '@/lib/types'
import { Page, PageHeader } from '@/components/layout/Page'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { useUI } from '@/store/ui'
import { cn } from '@/lib/utils'

const FALLBACK_PROVIDERS = [
  { id: 'ollama', label: 'Ollama (локально)', baseUrl: 'http://127.0.0.1:11434/v1', requiresKey: false },
  { id: 'lmstudio', label: 'LM Studio (локально)', baseUrl: 'http://127.0.0.1:1234/v1', requiresKey: false },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', requiresKey: true },
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', requiresKey: true },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', requiresKey: true },
  { id: 'custom', label: 'Свой OpenAI-совместимый', baseUrl: '', requiresKey: false },
  { id: 'anthropic', label: 'Anthropic', baseUrl: 'https://api.anthropic.com', requiresKey: true },
]

function Section({ title, description, children, icon: Icon }: {
  title: string
  description?: string
  children: React.ReactNode
  icon: typeof Server
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-surface-2 text-ink-soft">
            <Icon className="size-4" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <p className="mt-0.5 max-w-lg text-[12px] leading-relaxed text-muted">{description}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-muted">{hint}</span>}
    </label>
  )
}

export function SettingsPage() {
  const queryClient = useQueryClient()
  const toast = useToast((state) => state.push)
  const theme = useUI((state) => state.theme)
  const setTheme = useUI((state) => state.setTheme)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<SettingsInfo>('/api/settings'),
  })

  const [form, setForm] = useState<SettingsInfo | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [probe, setProbe] = useState<{ configured: boolean; ok?: boolean; models?: string[]; error?: string | null; detected?: { provider: string; models: string[] } | null; provider?: string; model?: string; baseUrl?: string } | null>(null)
  const [probing, setProbing] = useState(false)
  const [docker, setDocker] = useState<{ available: boolean; version: string | null; error: string | null } | null>(null)

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  if (isLoading || !form) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const providers = form.providers?.length ? form.providers : FALLBACK_PROVIDERS
  const providerInfo = providers.find((item) => item.id === form.llm.provider)

  const save = async (section: string, patch: Record<string, unknown>) => {
    setSavingSection(section)
    try {
      await api.put('/api/settings', patch)
      await refetch()
      await queryClient.invalidateQueries({ queryKey: ['bootstrap'] })
      toast({ tone: 'success', title: 'Сохранено' })
    } catch (error) {
      toast({ tone: 'error', title: 'Не удалось сохранить', description: (error as Error).message })
    } finally {
      setSavingSection(null)
    }
  }

  const saveLlm = async () => {
    setSavingSection('llm')
    try {
      const payload: Record<string, unknown> = {
        llm: {
          provider: form.llm.provider,
          baseUrl: form.llm.baseUrl,
          model: form.llm.model,
          temperature: form.llm.temperature,
          maxTokens: form.llm.maxTokens,
        },
      }
      if (apiKey.trim()) payload.apiKey = apiKey.trim()
      await api.put('/api/settings', payload)
      setApiKey('')
      await refetch()
      await queryClient.invalidateQueries({ queryKey: ['bootstrap'] })
      toast({ tone: 'success', title: 'Наставник сохранён' })
    } catch (error) {
      toast({ tone: 'error', title: 'Не удалось сохранить', description: (error as Error).message })
    } finally {
      setSavingSection(null)
    }
  }

  const runProbe = async () => {
    setProbing(true)
    try {
      const result = await api.get<typeof probe>('/api/settings/llm/probe')
      setProbe(result)
      if (result?.configured && result.ok) {
        toast({ tone: 'success', title: 'Провайдер отвечает', description: result.model || result.provider })
      } else if (result?.detected) {
        toast({ tone: 'info', title: `Найден ${result.detected.provider}`, description: 'Выбери его и модель ниже' })
      } else {
        toast({ tone: 'error', title: 'Провайдер не отвечает', description: result?.error || 'Проверь адрес и ключ' })
      }
    } catch (error) {
      toast({ tone: 'error', title: 'Ошибка проверки', description: (error as Error).message })
    } finally {
      setProbing(false)
    }
  }

  const exportData = async () => {
    try {
      const response = await fetch('/api/export')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `pitonika-backup-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      toast({ tone: 'success', title: 'Резервная копия сохранена' })
    } catch (error) {
      toast({ tone: 'error', title: 'Ошибка экспорта', description: (error as Error).message })
    }
  }

  const importData = async (file: File) => {
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      await api.post('/api/import', payload)
      await queryClient.invalidateQueries()
      await refetch()
      toast({ tone: 'success', title: 'Прогресс восстановлен' })
    } catch (error) {
      toast({ tone: 'error', title: 'Не удалось импортировать', description: (error as Error).message })
    }
  }

  const chooseProvider = (id: string) => {
    const info = providers.find((item) => item.id === id)
    setForm({
      ...form,
      llm: {
        ...form.llm,
        provider: id,
        baseUrl: info?.baseUrl ?? form.llm.baseUrl,
        model: '',
      },
    })
  }

  return (
    <Page width="narrow">
      <PageHeader
        eyebrow="Настройки"
        title="Всё под контролем"
        description="Приложение работает локально. Только запросы к выбранному ИИ-провайдеру уходят в сеть."
      />

      <div className="space-y-4">
        <Section icon={User} title="Профиль" description="Имя и цель дня влияют на мотивацию и подсказки наставника.">
          <ProfileFields
            onSave={(patch) => save('profile', patch)}
            saving={savingSection === 'profile'}
            dailyGoalXp={form.dailyGoalXp}
          />
        </Section>

        <Section
          icon={Wand2}
          title="Наставник"
          description="Локальные модели (Ollama, LM Studio) — бесплатно и приватно. Облачные API — быстрее и умнее, но требуют ключ."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Провайдер">
              <select
                value={form.llm.provider ?? ''}
                onChange={(event) => chooseProvider(event.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-line bg-paper px-3 text-[13px] outline-none focus:border-primary"
              >
                <option value="">Не подключён</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Модель" hint={providerInfo?.requiresKey ? 'Ключ хранится локально с правами 600' : 'Например, qwen3:8b или llama3.1:8b'}>
              <input
                value={form.llm.model}
                onChange={(event) => setForm({ ...form, llm: { ...form.llm, model: event.target.value } })}
                placeholder="qwen3:8b"
                className="mt-1 h-10 w-full rounded-xl border border-line bg-paper px-3 font-mono text-[12.5px] outline-none focus:border-primary"
              />
            </Field>
            <Field label="Адрес API" hint="Для Ollama: http://127.0.0.1:11434/v1">
              <input
                value={form.llm.baseUrl}
                onChange={(event) => setForm({ ...form, llm: { ...form.llm, baseUrl: event.target.value } })}
                placeholder="http://127.0.0.1:11434/v1"
                className="mt-1 h-10 w-full rounded-xl border border-line bg-paper px-3 font-mono text-[12px] outline-none focus:border-primary"
              />
            </Field>
            <Field label="API-ключ" hint={form.hasKey ? `Сохранён: ${form.keyMasked}` : 'Нужен только облачным провайдерам'}>
              <div className="relative mt-1">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={form.hasKey ? 'Оставь пустым, чтобы не менять' : 'sk-…'}
                  className="h-10 w-full rounded-xl border border-line bg-paper pl-9 pr-3 font-mono text-[12px] outline-none focus:border-primary"
                />
              </div>
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={saveLlm} loading={savingSection === 'llm'} size="sm">
              <Save className="size-3.5" />
              Сохранить
            </Button>
            <Button variant="secondary" size="sm" onClick={runProbe} loading={probing}>
              <RefreshCw className="size-3.5" />
              Проверить связь
            </Button>
            {probe?.configured && (
              <Badge tone={probe.ok ? 'primary' : 'danger'}>
                {probe.ok ? 'онлайн' : probe.error || 'нет ответа'}
              </Badge>
            )}
            {probe?.detected && <Badge tone="info">найден {probe.detected.provider}</Badge>}
          </div>

          {probe?.models && probe.models.length > 0 && (
            <div className="mt-3 rounded-xl border border-line bg-surface-2/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Доступные модели</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {probe.models.slice(0, 18).map((model) => (
                  <button
                    key={model}
                    onClick={() => setForm({ ...form, llm: { ...form.llm, model } })}
                    className={cn(
                      'rounded-full border px-2.5 py-1 font-mono text-[11px] transition',
                      form.llm.model === model
                        ? 'border-primary bg-primary-soft text-primary-strong'
                        : 'border-line bg-surface hover:border-primary/40',
                    )}
                  >
                    {model}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-line bg-surface-2/50 p-3 text-[11.5px] leading-relaxed text-muted">
            <p className="font-medium text-ink-soft">Как подключить локальную модель</p>
            <pre className="mt-1.5 overflow-x-auto rounded-lg bg-surface p-2 font-mono text-[11px] text-ink-soft">
{`brew install ollama
ollama serve
ollama pull qwen3:8b`}
            </pre>
            <p className="mt-1.5">После запуска нажми «Проверить связь», выбери модель и сохрани.</p>
          </div>
        </Section>

        <Section icon={Terminal} title="Выполнение кода" description="Код запускается локально в отдельном процессе с таймаутом и лимитом вывода.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Интерпретатор Python" hint="Оставь python3, если не уверен">
              <input
                value={form.pythonPath}
                onChange={(event) => setForm({ ...form, pythonPath: event.target.value })}
                className="mt-1 h-10 w-full rounded-xl border border-line bg-paper px-3 font-mono text-[12px] outline-none focus:border-primary"
              />
            </Field>
            <Field label="Таймаут, секунды" hint="От 1 до 15">
              <input
                type="number"
                min={1}
                max={15}
                value={form.timeoutSeconds}
                onChange={(event) => setForm({ ...form, timeoutSeconds: Number(event.target.value) })}
                className="mt-1 h-10 w-full rounded-xl border border-line bg-paper px-3 text-[13px] outline-none focus:border-primary"
              />
            </Field>
          </div>
          <label className="mt-3 flex items-start gap-2.5 rounded-xl border border-line bg-surface-2/40 p-3">
            <input
              type="checkbox"
              checked={form.strictMode}
              onChange={(event) => setForm({ ...form, strictMode: event.target.checked })}
              className="mt-0.5 size-4 accent-[var(--color-primary)]"
            />
            <span>
              <span className="block text-[12.5px] font-medium">Строгий режим через Docker</span>
              <span className="block text-[11px] leading-snug text-muted">
                Запускает код в контейнере без сети. Нужен установленный Docker; на macOS это единственный способ
                настоящей изоляции.
              </span>
            </span>
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                try {
                  setDocker(await api.get('/api/settings/docker/check'))
                } catch (error) {
                  toast({ tone: 'error', title: 'Не удалось проверить Docker', description: (error as Error).message })
                }
              }}
            >
              <RefreshCw className="size-3.5" />
              Проверить Docker
            </Button>
            {docker && (
              <Badge tone={docker.available ? 'primary' : 'danger'}>
                {docker.available ? `Docker ${docker.version}` : docker.error || 'недоступен'}
              </Badge>
            )}
            {!docker && <span className="text-[11px] text-muted">Нужен только для строгого режима</span>}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              loading={savingSection === 'code'}
              onClick={() =>
                save('code', {
                  pythonPath: form.pythonPath,
                  timeoutSeconds: form.timeoutSeconds,
                  strictMode: form.strictMode,
                })
              }
            >
              <Save className="size-3.5" />
              Сохранить
            </Button>
            <span className="text-[11px] text-muted">
              Проверить: <code className="font-mono">{form.pythonPath} --version</code>
            </span>
          </div>
        </Section>

        <Section icon={Monitor} title="Интерфейс">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'light', label: 'Светлая', icon: Sun },
              { id: 'dark', label: 'Тёмная', icon: Moon },
              { id: 'system', label: 'Как в системе', icon: Monitor },
            ].map((option) => {
              const Icon = option.icon
              return (
                <button
                  key={option.id}
                  onClick={() => setTheme(option.id as 'light' | 'dark' | 'system')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium transition',
                    theme === option.id
                      ? 'border-primary bg-primary-soft text-primary-strong'
                      : 'border-line bg-surface text-ink-soft hover:border-line-strong',
                  )}
                >
                  <Icon className="size-3.5" />
                  {option.label}
                  {theme === option.id && <Check className="size-3" />}
                </button>
              )
            })}
          </div>
        </Section>

        <Section icon={Server} title="Данные" description="Прогресс хранится в SQLite в папке data/. Резервная копия — обычный JSON.">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={exportData}>
              <Download className="size-4" />
              Скачать копию
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" />
              Восстановить
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void importData(file)
                event.target.value = ''
              }}
            />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Импорт заменяет текущий прогресс. Перед восстановлением сохрани копию.
          </p>
        </Section>
      </div>
    </Page>
  )
}

function ProfileFields({
  onSave,
  saving,
  dailyGoalXp,
}: {
  onSave: (patch: Record<string, unknown>) => void
  saving: boolean
  dailyGoalXp: number
}) {
  const [name, setName] = useState('')
  const [goal, setGoal] = useState(dailyGoalXp)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void api.get<{ profile: { name: string } }>('/api/bootstrap').then((data) => {
      setName(data.profile.name)
      setLoaded(true)
    })
  }, [])

  if (!loaded) return <Spinner className="size-4" />

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Как обращаться">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-line bg-paper px-3 text-[13px] outline-none focus:border-primary"
          />
        </Field>
        <Field label="Цель дня, XP" hint="10 XP ≈ один шаг урока">
          <input
            type="number"
            min={10}
            max={400}
            step={10}
            value={goal}
            onChange={(event) => setGoal(Number(event.target.value))}
            className="mt-1 h-10 w-full rounded-xl border border-line bg-paper px-3 text-[13px] outline-none focus:border-primary"
          />
        </Field>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          loading={saving}
          onClick={() => {
            void api.patch('/api/profile', { name })
            onSave({ dailyGoalXp: goal })
          }}
        >
          <Save className="size-3.5" />
          Сохранить профиль
        </Button>
      </div>
    </>
  )
}
