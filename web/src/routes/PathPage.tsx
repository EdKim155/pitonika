import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  ChevronRight,
  Flame,
  Lock,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react'
import type { Bootstrap, LessonSummary, ModuleInfo } from '@/lib/types'
import { Page } from '@/components/layout/Page'
import { Button } from '@/components/ui/Button'
import { Progress, Ring } from '@/components/ui/Progress'
import { cn, plural } from '@/lib/utils'

const accents: Record<string, string> = {
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  teal: 'bg-teal-500',
  indigo: 'bg-indigo-500',
  orange: 'bg-orange-500',
  cyan: 'bg-cyan-500',
  lime: 'bg-lime-500',
  fuchsia: 'bg-fuchsia-500',
  slate: 'bg-slate-500',
}

function LessonTile({ lesson, accent }: { lesson: LessonSummary; accent: string }) {
  const locked = lesson.status === 'locked'
  const done = lesson.status === 'done'
  const current = lesson.status === 'current'

  const content = (
    <>
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl border transition',
          done && 'border-primary/30 bg-primary-soft text-primary-strong',
          current && 'border-primary bg-primary text-on-primary shadow-[0_6px_14px_-6px_rgba(14,159,110,0.7)]',
          !done && !current && !locked && 'border-line bg-surface-2 text-ink-soft',
          locked && 'border-line bg-surface-2 text-muted/60',
        )}
      >
        {done ? <Check className="size-4" /> : current ? <Play className="size-4" /> : locked ? <Lock className="size-3.5" /> : <Play className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[13.5px] font-medium', locked ? 'text-muted' : 'text-ink')}>
          {lesson.title}
        </span>
        <span className="mt-0.5 block text-[11.5px] text-muted">
          {lesson.minutes} мин · {lesson.steps} {plural(lesson.steps, 'шаг', 'шага', 'шагов')}
          {done && lesson.score > 0 && ` · ${Math.round(lesson.score * 100)}%`}
        </span>
      </span>
      {!locked && (
        <ChevronRight className={cn('size-4 shrink-0 transition', current ? 'text-primary-strong' : 'text-muted/50 group-hover:text-muted')} />
      )}
    </>
  )

  if (locked) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line/70 bg-surface-2/40 px-3.5 py-3 opacity-70" title="Сначала пройди предыдущий урок">
        {content}
      </div>
    )
  }

  return (
    <Link
      to={`/lesson/${lesson.id}`}
      className={cn(
        'group flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition hover:-translate-y-0.5 hover:shadow-soft',
        current ? 'border-primary/50 bg-primary-soft/40' : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      {content}
      {current && <span className="hidden rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-on-primary sm:block">сейчас</span>}
      {lesson.status === 'available' && <span className={cn('hidden size-1.5 rounded-full sm:block', accent)} />}
    </Link>
  )
}

function ModuleBlock({ module }: { module: ModuleInfo }) {
  const accent = accents[module.color] || accents.emerald
  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
      <div className="flex items-center gap-3 border-b border-line px-4 py-4 sm:px-5">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl text-[13px] font-bold text-white shadow-sm', accent)}>
          {module.number}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold tracking-tight">{module.title}</h2>
          <p className="truncate text-[12px] text-muted">{module.subtitle}</p>
        </div>
        <div className="hidden w-32 sm:block">
          <div className="mb-1 flex justify-between text-[10.5px] text-muted">
            <span>
              {module.done}/{module.total}
            </span>
            <span>{Math.round(module.progress * 100)}%</span>
          </div>
          <Progress value={module.progress * 100} className="h-1.5" />
        </div>
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4">
        {module.lessons.map((lesson) => (
          <LessonTile key={lesson.id} lesson={lesson} accent={accent} />
        ))}
      </div>
    </section>
  )
}

export function PathPage() {
  const data = useOutletContext<Bootstrap>()
  const navigate = useNavigate()
  const { profile, path, dueReviews, lessonsCount } = data
  const lessons = path.flatMap((module) => module.lessons)
  const current = lessons.find((lesson) => lesson.status === 'current')
  const currentModule = path.find((module) => module.lessons.some((lesson) => lesson.id === current?.id))
  const doneLessons = lessons.filter((lesson) => lesson.status === 'done').length
  const goalPercent = Math.min(100, Math.round((profile.xpToday / Math.max(1, profile.dailyGoalXp)) * 100))
  const firstName = profile.name || 'Ученик'
  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <Page>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-primary-strong">
            {today}
          </p>
          <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight md:text-[30px]">
            Привет, {firstName}! <span className="text-muted">Продолжим?</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2">
            <Ring value={goalPercent} size={34} stroke={3.5}>
              <span className="text-[10px] font-bold">{goalPercent}%</span>
            </Ring>
            <div className="leading-tight">
              <p className="text-[10.5px] uppercase tracking-wide text-muted">цель дня</p>
              <p className="text-[12.5px] font-semibold">
                {profile.xpToday} / {profile.dailyGoalXp} XP
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 sm:flex">
            <Flame className="size-4 text-accent" />
            <div className="leading-tight">
              <p className="text-[10.5px] uppercase tracking-wide text-muted">серия</p>
              <p className="text-[12.5px] font-semibold">
                {profile.streak.current} {plural(profile.streak.current, 'день', 'дня', 'дней')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {dueReviews > 0 && (
        <Link
          to="/review"
          className="mb-4 flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 text-[13px] text-[#7a5a00] transition hover:brightness-[0.99] dark:text-accent"
        >
          <RotateCcw className="size-4 shrink-0" />
          <span className="flex-1 font-medium">
            Пора повторить {dueReviews} {plural(dueReviews, 'тему', 'темы', 'тем')} — это займёт пару минут
          </span>
          <ArrowRight className="size-4" />
        </Link>
      )}

      <div className="relative mb-6 overflow-hidden rounded-3xl border border-primary/25 bg-surface p-5 shadow-soft sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-primary-strong">
              <Sparkles className="size-3.5" />
              {current ? 'Следующий шаг' : 'Путь пройден'}
            </p>
            <h2 className="mt-2 text-[20px] font-semibold leading-tight tracking-tight sm:text-[23px]">
              {current ? current.title : 'Все уроки текущей программы пройдены'}
            </h2>
            <p className="mt-1.5 text-[13px] text-muted">
              {current
                ? `${currentModule?.title} · ${current.minutes} мин · ${current.steps} ${plural(current.steps, 'шаг', 'шага', 'шагов')}`
                : `Пройдено ${doneLessons} из ${lessonsCount}. Загляни в прогресс и повторение.`}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
              <span className="rounded-full bg-surface-2 px-2 py-0.5">
                Уровень {profile.level.level} · {profile.level.title}
              </span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5">
                {doneLessons}/{lessonsCount} уроков
              </span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5">{profile.level.xp} XP</span>
            </div>
          </div>
          {current ? (
            <Button size="lg" className="w-full sm:w-auto" onClick={() => navigate(`/lesson/${current.id}`)}>
              Продолжить
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button size="lg" variant="secondary" className="w-full sm:w-auto" onClick={() => navigate('/progress')}>
              Смотреть прогресс
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">Программа</h2>
        <span className="flex items-center gap-1 text-[11.5px] text-muted">
          <Zap className="size-3.5" />+10 XP за шаг
        </span>
      </div>

      <div className="space-y-4">
        {path.map((module) => (
          <ModuleBlock key={module.id} module={module} />
        ))}
      </div>
    </Page>
  )
}
