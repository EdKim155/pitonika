import { useQuery } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router-dom'
import { ArrowRight, Dumbbell, Sparkles, Target } from 'lucide-react'
import { api } from '@/lib/api'
import type { Bootstrap, PracticeSuggestion } from '@/lib/types'
import { Page, PageHeader } from '@/components/layout/Page'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { plural } from '@/lib/utils'

const typeLabels: Record<string, string> = {
  code: 'код',
  debug: 'отладка',
  quiz: 'вопрос',
  predict: 'вывод',
  blank: 'пропуски',
  parsons: 'сборка',
  theory: 'теория',
  open: 'ответ',
}

export function PracticePage() {
  const data = useOutletContext<Bootstrap>()
  const { data: payload, isLoading } = useQuery({
    queryKey: ['practice'],
    queryFn: () => api.get<{ suggestions: PracticeSuggestion[] }>('/api/practice/suggestions'),
    staleTime: 10_000,
  })

  const suggestions = payload?.suggestions ?? []

  return (
    <Page>
      <PageHeader
        eyebrow="Тренировка"
        title="Практика по слабым местам"
        description="Короткие задачи из уже пройденных уроков. Подборка строится по тому, где ты ошибался чаще всего."
        action={
          <Link to="/path">
            <Button variant="secondary">
              К урокам
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner />
        </div>
      ) : suggestions.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-strong">
            <Dumbbell className="size-6" />
          </div>
          <h2 className="mt-3 text-[17px] font-semibold">Пока нечего тренировать</h2>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-muted">
            Практика собирается из пройденных уроков. Заверши первый урок — и здесь появятся персональные задания.
          </p>
          <Link to="/path" className="mt-4 inline-block">
            <Button>
              Перейти к первому уроку
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-[12.5px] text-muted">
            <Target className="size-4 text-primary-strong" />
            Подобрано {suggestions.length} {plural(suggestions.length, 'задание', 'задания', 'заданий')} по темам с наименьшим
            мастерством
            <span className="ml-auto flex items-center gap-1 text-[11.5px]">
              <Sparkles className="size-3.5" /> цель дня: {data.profile.xpToday}/{data.profile.dailyGoalXp} XP
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {suggestions.map((item) => (
              <Card key={item.stepId} className="flex flex-col p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{typeLabels[item.type] ?? item.type}</Badge>
                  <span className="truncate text-[11.5px] text-muted">{item.lessonTitle}</span>
                  <span className="ml-auto text-[11px] tabular-nums text-muted">{Math.round(item.mastery * 100)}%</span>
                </div>
                <p className="mt-2 text-[14px] font-semibold leading-snug">{item.conceptTitle || 'Задание'}</p>
                <Progress value={item.mastery * 100} className="mt-2 h-1.5" />
                <Link
                  to={`/lesson/${item.lessonId}?step=${encodeURIComponent(item.stepId)}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary-strong hover:underline"
                >
                  Тренировать
                  <ArrowRight className="size-3.5" />
                </Link>
              </Card>
            ))}
          </div>
        </>
      )}
    </Page>
  )
}
