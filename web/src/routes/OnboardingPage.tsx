import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Brain,
  Briefcase,
  Check,
  Clock,
  Code2,
  Flame,
  Gamepad2,
  LineChart,
  Rocket,
  Sparkles,
  Target,
  Terminal,
  Zap,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn, plural } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

const goals = [
  { id: 'base', title: 'С нуля для себя', description: 'Разобраться в программировании без спешки', icon: Rocket },
  { id: 'work', title: 'Для работы', description: 'Автоматизация, скрипты, данные', icon: Briefcase },
  { id: 'interview', title: 'К собеседованиям', description: 'Алгоритмы и уверенный код', icon: Target },
  { id: 'refresh', title: 'Вспомнить забытое', description: 'Быстро вернуться в форму', icon: Brain },
]

const experiences = [
  { id: 'zero', title: 'Совсем с нуля', description: 'Не писал(а) код никогда' },
  { id: 'some', title: 'Пробовал(а)', description: 'Знаю, что такое переменные и циклы' },
  { id: 'confident', title: 'Уверенно', description: 'Могу написать небольшую программу' },
]

const interests = [
  { id: 'games', label: 'Игры', icon: Gamepad2 },
  { id: 'data', label: 'Данные и графики', icon: LineChart },
  { id: 'web', label: 'Сайты', icon: Code2 },
  { id: 'automation', label: 'Автоматизация', icon: Terminal },
  { id: 'bots', label: 'Боты', icon: Sparkles },
]

const timeOptions = [5, 10, 20, 30]

export function OnboardingPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast((state) => state.push)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    goal: 'base',
    dailyMinutes: 10,
    experience: 'zero',
    interests: [] as string[],
  })

  const { data: bootstrap } = useQuery({
    queryKey: ['bootstrap'],
    queryFn: () => api.get<{ profile: { onboarded: boolean } }>('/api/bootstrap'),
    staleTime: 0,
  })

  useEffect(() => {
    if (bootstrap?.profile.onboarded) navigate('/path', { replace: true })
  }, [bootstrap?.profile.onboarded, navigate])

  const totalSteps = 5
  const progress = Math.round(((step + 1) / totalSteps) * 100)

  const canContinue = step !== 0 || form.name.trim().length >= 2

  const toggleInterest = (id: string) => {
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(id)
        ? current.interests.filter((item) => item !== id)
        : [...current.interests, id],
    }))
  }

  const finish = async () => {
    setSaving(true)
    try {
      await api.post('/api/profile/onboarding', {
        name: form.name.trim() || 'Ученик',
        goal: form.goal,
        dailyMinutes: form.dailyMinutes,
        experience: form.experience,
        interests: form.interests,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow',
      })
      await queryClient.refetchQueries({ queryKey: ['bootstrap'] })
      toast({ tone: 'success', title: `Добро пожаловать в Питонику, ${form.name.trim() || 'Ученик'}!` })
      navigate('/path', { replace: true })
    } catch (error) {
      toast({ tone: 'error', title: 'Не удалось сохранить профиль', description: (error as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const dailyPlan = useMemo(() => {
    const lessons = Math.max(1, Math.round(form.dailyMinutes / 8))
    return `${lessons} ${plural(lessons, 'урок', 'урока', 'уроков')} · ~${form.dailyMinutes} минут в день`
  }, [form.dailyMinutes])

  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[1.02fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#0b1a14] p-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -left-24 top-10 size-[420px] rounded-full bg-primary/25 blur-[110px]" />
        <div className="pointer-events-none absolute -right-20 bottom-0 size-[380px] rounded-full bg-accent/15 blur-[110px]" />

        <div className="relative flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-white/10">
            <svg viewBox="0 0 32 32" className="size-5" fill="none" aria-hidden>
              <path d="M8 21c0-4.4 3.6-8 8-8h3a4 4 0 0 0 0-8h-2" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              <circle cx="9" cy="23" r="2.6" fill="#f5b700" />
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-semibold">Питоника</p>
            <p className="text-[10.5px] uppercase tracking-[0.16em] text-white/50">Python с нуля</p>
          </div>
        </div>

        <div className="relative mt-auto max-w-md">
          <h1 className="text-[38px] font-semibold leading-[1.1] tracking-tight">
            Научись программировать <span className="text-primary">по 10 минут</span> в день
          </h1>
          <p className="mt-4 text-[14.5px] leading-relaxed text-white/65">
            Уроки, задачи с автопроверкой и наставник, который объясняет ошибки простыми словами. Прогресс сохраняется
            локально — без регистрации и облака.
          </p>

          <div className="mt-8 space-y-3">
            {[
              { icon: Code2, text: 'Код выполняется по-настоящему, прямо в браузере' },
              { icon: LightbulbIcon, text: 'Подсказки в три шага — без готовых ответов' },
              { icon: Flame, text: 'Серия дней, XP и уровни, как в любимых играх' },
              { icon: BarChart3, text: 'Видно, какие темы просели и что повторить' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3 text-[13.5px] text-white/80">
                <div className="flex size-8 items-center justify-center rounded-lg bg-white/8">
                  <item.icon className="size-4 text-primary" />
                </div>
                {item.text}
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-10 flex items-center gap-2 text-[11.5px] text-white/40">
          <Zap className="size-3.5" />
          Полностью локально · macOS · без подписок
        </div>
      </aside>

      <main className="flex flex-col px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[11.5px] font-medium text-muted">
            {step + 1}/{totalSteps}
          </span>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
          {step === 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary-strong">Знакомство</p>
              <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">Как тебя зовут?</h2>
              <p className="mt-2 text-[14px] text-muted">Так наставник будет обращаться к тебе в уроках.</p>
              <input
                autoFocus
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && canContinue) setStep(1)
                }}
                placeholder="Например, Эдгар"
                className="mt-6 h-12 w-full rounded-xl border border-line bg-surface px-4 text-[15px] outline-none transition focus:border-primary"
              />
              <p className="mt-2 text-[12px] text-muted">Можно пропустить — тогда будешь просто «Ученик».</p>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary-strong">Цель</p>
              <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">Зачем тебе Python?</h2>
              <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {goals.map((goal) => {
                  const Icon = goal.icon
                  const active = form.goal === goal.id
                  return (
                    <button
                      key={goal.id}
                      onClick={() => setForm({ ...form, goal: goal.id })}
                      className={cn(
                        'rounded-2xl border p-4 text-left transition',
                        active
                          ? 'border-primary/60 bg-primary-soft/60 shadow-soft'
                          : 'border-line bg-surface hover:border-line-strong',
                      )}
                    >
                      <Icon className={cn('size-5', active ? 'text-primary-strong' : 'text-muted')} />
                      <p className="mt-2 text-[13.5px] font-semibold">{goal.title}</p>
                      <p className="mt-0.5 text-[12px] leading-snug text-muted">{goal.description}</p>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary-strong">Ритм</p>
              <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">Сколько времени в день?</h2>
              <div className="mt-6 grid grid-cols-4 gap-2">
                {timeOptions.map((minutes) => (
                  <button
                    key={minutes}
                    onClick={() => setForm({ ...form, dailyMinutes: minutes })}
                    className={cn(
                      'rounded-xl border py-3 text-center transition',
                      form.dailyMinutes === minutes
                        ? 'border-primary/60 bg-primary-soft/60'
                        : 'border-line bg-surface hover:border-line-strong',
                    )}
                  >
                    <span className="text-[17px] font-semibold">{minutes}</span>
                    <span className="ml-0.5 text-[11px] text-muted">мин</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[12px] text-muted">
                <Clock className="size-3.5" />
                {dailyPlan}
              </div>

              <h3 className="mt-7 text-[14px] font-semibold">Твой опыт в программировании</h3>
              <div className="mt-2.5 space-y-2">
                {experiences.map((experience) => {
                  const active = form.experience === experience.id
                  return (
                    <button
                      key={experience.id}
                      onClick={() => setForm({ ...form, experience: experience.id })}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition',
                        active ? 'border-primary/60 bg-primary-soft/50' : 'border-line bg-surface hover:border-line-strong',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-5 items-center justify-center rounded-full border',
                          active ? 'border-primary bg-primary text-on-primary' : 'border-line-strong',
                        )}
                      >
                        {active && <Check className="size-3" />}
                      </span>
                      <span>
                        <span className="block text-[13px] font-medium">{experience.title}</span>
                        <span className="block text-[11.5px] text-muted">{experience.description}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary-strong">Интересы</p>
              <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">Что тебе ближе?</h2>
              <p className="mt-2 text-[14px] text-muted">Подберём примеры и задачи по духу. Можно выбрать несколько.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {interests.map((interest) => {
                  const Icon = interest.icon
                  const active = form.interests.includes(interest.id)
                  return (
                    <button
                      key={interest.id}
                      onClick={() => toggleInterest(interest.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition',
                        active
                          ? 'border-primary/60 bg-primary-soft text-primary-strong'
                          : 'border-line bg-surface text-ink-soft hover:border-line-strong',
                      )}
                    >
                      <Icon className="size-3.5" />
                      {interest.label}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary-strong">Готово</p>
              <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">
                {form.name.trim() || 'Ученик'}, всё готово
              </h2>
              <p className="mt-2 text-[14px] text-muted">Вот с чего начнём. Первый урок займёт около 7 минут.</p>

              <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="flex items-center gap-3 border-b border-line bg-primary-soft/50 px-4 py-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-on-primary">
                    <Rocket className="size-4" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold">Модуль 0 · Старт</p>
                    <p className="text-[11.5px] text-muted">Первая программа и первые ошибки</p>
                  </div>
                </div>
                <div className="space-y-2 p-4 text-[12.5px] text-ink-soft">
                  <div className="flex items-center justify-between">
                    <span>Первый урок</span>
                    <span className="font-medium">Первая программа</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Темп</span>
                    <span className="font-medium">{dailyPlan}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Стартовый уровень</span>
                    <span className="font-medium">{experiences.find((item) => item.id === form.experience)?.title}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-xl border border-info/25 bg-info-soft px-3 py-2.5 text-[12px] leading-snug text-info">
                <Sparkles className="mt-0.5 size-3.5 shrink-0" />
                Наставника можно подключить позже: в Настройках есть Ollama, LM Studio и облачные API. Без него работают
                авторские подсказки.
              </div>
            </motion.div>
          )}

          <div className="mt-8 flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)} className="px-3">
                <ArrowLeft className="size-4" />
                Назад
              </Button>
            )}
            <div className="flex-1" />
            {step < 4 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canContinue} size="lg">
                Далее
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={finish} loading={saving} size="lg" className="min-w-44">
                Начать обучение
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function LightbulbIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={props.className} strokeLinecap="round">
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6V17h5.4v-1.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3Z" />
    </svg>
  )
}
