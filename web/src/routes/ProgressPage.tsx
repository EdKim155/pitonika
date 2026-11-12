import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowRight,
  CalendarDays,
  Flame,
  Medal,
  RotateCcw,
  Target,
  Trophy,
  Zap,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { ProgressSummary } from '@/lib/types'
import { Page, PageHeader } from '@/components/layout/Page'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress, Ring } from '@/components/ui/Progress'
import { Spinner } from '@/components/ui/Spinner'
import { cn, formatMinutes, plural } from '@/lib/utils'

const CHART = {
  primary: '#0e9f6e',
  accent: '#f5b700',
  grid: 'rgba(107,122,117,0.18)',
}

function StatCard({ label, value, hint, icon: Icon, tone = 'default' }: {
  label: string
  value: string
  hint?: string
  icon: typeof Zap
  tone?: 'default' | 'accent'
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted">
        <Icon className={cn('size-4', tone === 'accent' && 'text-accent')} />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-[24px] font-semibold leading-none tracking-tight">{value}</p>
      {hint && <p className="mt-1.5 text-[11.5px] text-muted">{hint}</p>}
    </Card>
  )
}

function Heatmap({ days }: { days: ProgressSummary['heatmap'] }) {
  const value = (xp: number) => {
    if (xp <= 0) return 0
    if (xp < 20) return 1
    if (xp < 50) return 2
    if (xp < 100) return 3
    return 4
  }
  const colors = ['bg-surface-2', 'bg-primary/20', 'bg-primary/40', 'bg-primary/65', 'bg-primary']
  return (
    <div>
      <div className="grid grid-flow-col grid-rows-7 gap-[3px] overflow-x-auto pb-1">
        {days.map((day) => (
          <div
            key={day.date}
            className={cn('size-[13px] rounded-[3px] transition hover:ring-2 hover:ring-primary/40', colors[value(day.xp)])}
            title={`${new Date(day.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}: ${day.xp} XP`}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-muted">
        <span>меньше</span>
        {colors.map((color) => (
          <span key={color} className={cn('size-2.5 rounded-[2px]', color)} />
        ))}
        <span>больше</span>
      </div>
    </div>
  )
}

export function ProgressPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get<ProgressSummary>('/api/progress/summary'),
    staleTime: 15_000,
  })

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const last30 = data.heatmap.slice(-30).map((day, index) => ({
    day: index + 1,
    label: new Date(day.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
    xp: day.xp,
  }))
  const radar = data.coreConcepts.map((concept) => ({
    subject: concept.title.length > 16 ? `${concept.title.slice(0, 15)}…` : concept.title,
    mastery: Math.round(concept.mastery * 100),
  }))
  const accuracy = data.accuracyByKind.map((item) => ({
    name: item.kind === 'code' ? 'код' : item.kind === 'quiz' ? 'вопросы' : item.kind,
    accuracy: Math.round(item.accuracy * 100),
  }))
  const unlocked = data.achievements.filter((item) => item.unlockedAt).length

  return (
    <Page>
      <PageHeader
        eyebrow="Аналитика"
        title="Твой прогресс"
        description="Видно, что уже получается, а что стоит повторить. Данные хранятся только на этом компьютере."
        action={
          <div className="flex items-center gap-2">
            <Ring value={data.level.percent} size={48} stroke={4}>
              <div className="text-center leading-none">
                <p className="text-[12px] font-bold">{data.level.level}</p>
                <p className="text-[8px] uppercase text-muted">ур.</p>
              </div>
            </Ring>
            <div>
              <p className="text-[13px] font-semibold">{data.level.title}</p>
              <p className="text-[11.5px] text-muted">{data.level.xp} XP</p>
            </div>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Серия" value={`${data.streak.current} ${plural(data.streak.current, 'день', 'дня', 'дней')}`} hint={`Лучшая: ${data.streak.best}`} icon={Flame} tone="accent" />
        <StatCard label="Уроков" value={String(data.totals.lessons)} hint={`${data.totals.steps} шагов пройдено`} icon={Target} />
        <StatCard label="Точность" value={`${Math.round(data.totals.accuracy * 100)}%`} hint={`${data.totals.attempts} проверок`} icon={Medal} />
        <StatCard label="Время" value={formatMinutes(data.totals.minutes)} hint="за всё время" icon={CalendarDays} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Активность</CardTitle>
              <p className="mt-0.5 text-[11.5px] text-muted">Последние 12 недель</p>
            </div>
            <Badge tone="primary">{data.streak.current} дн. подряд</Badge>
          </CardHeader>
          <CardContent className="pt-4">
            <Heatmap days={data.heatmap} />
            <div className="mt-5 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={last30} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="xpFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={CHART.primary} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8b9a93' }} tickLine={false} axisLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 10, fill: '#8b9a93' }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid var(--color-line)', background: 'var(--color-surface)', fontSize: 12 }}
                    formatter={(value) => [`${value} XP`, 'за день']}
                  />
                  <Area type="monotone" dataKey="xp" stroke={CHART.primary} strokeWidth={2} fill="url(#xpFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Мастерство тем</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            {radar.length >= 3 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radar} outerRadius="72%">
                    <PolarGrid stroke={CHART.grid} />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9.5, fill: '#8b9a93' }} />
                    <Radar dataKey="mastery" stroke={CHART.primary} fill={CHART.primary} fillOpacity={0.22} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-10 text-center text-[12px] text-muted">Пройди несколько тем, чтобы увидеть карту знаний.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Слабые темы</CardTitle>
            <Link to="/practice" className="flex items-center gap-1 text-[11.5px] font-medium text-primary-strong hover:underline">
              Тренировать <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-3">
            {data.weakConcepts.length === 0 && <p className="text-[12.5px] text-muted">Пока нет данных — начни с первого урока.</p>}
            {data.weakConcepts.map((concept) => (
              <div key={concept.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium">{concept.title}</p>
                  <Progress value={concept.mastery * 100} className="mt-1 h-1.5" />
                </div>
                <span className="w-9 text-right text-[11.5px] tabular-nums text-muted">{Math.round(concept.mastery * 100)}%</span>
              </div>
            ))}
            {data.weakConcepts.length > 0 && (
              <Link
                to="/practice"
                className="mt-1 flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface-2/60 py-2 text-[12px] font-medium text-ink-soft transition hover:border-primary/40 hover:text-primary-strong"
              >
                <RotateCcw className="size-3.5" /> Открыть тренировку
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Точность по типам</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accuracy} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8b9a93' }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#8b9a93' }} tickLine={false} axisLine={false} width={34} />
                  <Tooltip
                    cursor={{ fill: 'rgba(107,122,117,0.08)' }}
                    contentStyle={{ borderRadius: 12, border: '1px solid var(--color-line)', background: 'var(--color-surface)', fontSize: 12 }}
                    formatter={(value) => [`${value}%`, 'точность']}
                  />
                  <Bar dataKey="accuracy" fill={CHART.primary} radius={[6, 6, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>Достижения</CardTitle>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Открыто {unlocked} из {data.achievements.length}
            </p>
          </div>
          <Trophy className="size-4 text-accent" />
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 pt-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.achievements.map((achievement) => {
            const isOpen = Boolean(achievement.unlockedAt)
            return (
              <div
                key={achievement.id}
                className={cn(
                  'rounded-xl border p-3 transition',
                  isOpen ? 'border-accent/40 bg-accent-soft/40' : 'border-line bg-surface-2/40 opacity-60',
                )}
                title={achievement.description}
              >
                <div
                  className={cn(
                    'flex size-8 items-center justify-center rounded-lg',
                    isOpen ? 'bg-accent text-[#3a2a00]' : 'bg-surface text-muted',
                  )}
                >
                  <Zap className="size-4" />
                </div>
                <p className="mt-2 text-[12px] font-semibold leading-tight">{achievement.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-muted">{achievement.description}</p>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.modules.map((module) => (
          <div key={module.id} className="rounded-2xl border border-line bg-surface p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] font-semibold">{module.title}</p>
              <span className="text-[11px] text-muted">
                {module.done}/{module.total}
              </span>
            </div>
            <Progress value={module.progress * 100} className="mt-2 h-1.5" />
          </div>
        ))}
      </div>
    </Page>
  )
}
