import { ArrowRight, Check, Flame, Sparkles, Trophy, Zap } from 'lucide-react'
import type { LessonCompleteResponse, LessonPayload } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Ring } from '@/components/ui/Progress'
import { cn, plural } from '@/lib/utils'

export function LessonComplete({
  lesson,
  result,
  onNextLesson,
  onBackToPath,
  hasNext,
}: {
  lesson: LessonPayload
  result: LessonCompleteResponse
  onNextLesson: () => void
  onBackToPath: () => void
  hasNext: boolean
}) {
  return (
    <div className="animate-pop mx-auto max-w-xl">
      <Card className="overflow-hidden border-primary/25">
        <div className="relative bg-gradient-to-br from-primary-soft via-surface to-surface p-7 text-center">
          <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-64 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative mx-auto flex size-16 items-center justify-center rounded-3xl bg-primary text-on-primary shadow-[0_16px_40px_-16px_rgba(14,159,110,0.8)]">
            <Check className="size-8" strokeWidth={3} />
          </div>
          <h1 className="relative mt-4 text-[24px] font-semibold tracking-tight">Урок пройден!</h1>
          <p className="relative mt-1 text-[13.5px] text-muted">{lesson.title}</p>

          <div className="relative mt-5 flex items-center justify-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3 py-1.5 text-[12.5px] font-semibold text-[#7a5a00] dark:text-accent">
              <Zap className="size-3.5" />+{result.xpGained} XP
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold">
              <Flame className="size-3.5 text-accent" />
              {result.streak.current} {plural(result.streak.current, 'день', 'дня', 'дней')} подряд
            </span>
          </div>
        </div>

        <div className="border-t border-line p-5">
          <div className="flex items-center gap-4">
            <Ring value={result.level.percent} size={56} stroke={5}>
              <div className="text-center leading-none">
                <p className="text-[13px] font-bold">{result.level.level}</p>
                <p className="text-[8px] uppercase text-muted">ур.</p>
              </div>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold">
                {result.level.title} · {result.level.xp} XP
              </p>
              <p className="text-[11.5px] text-muted">
                До следующего уровня: {Math.max(0, result.level.nextLevelXp - result.level.xp)} XP
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-primary" style={{ width: `${result.level.percent}%` }} />
              </div>
            </div>
          </div>

          {result.achievements.length > 0 && (
            <div className="mt-4 rounded-2xl border border-accent/35 bg-accent-soft/50 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#7a5a00] dark:text-accent">
                <Trophy className="size-3.5" /> Новые достижения
              </p>
              <div className="mt-1.5 space-y-1">
                {result.achievements.map((achievement) => (
                  <p key={achievement.id} className="text-[12.5px] text-ink-soft">
                    <span className="font-semibold">{achievement.title}</span> — {achievement.description}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            {hasNext && (
              <Button onClick={onNextLesson} size="lg" className="flex-1">
                Следующий урок
                <ArrowRight className="size-4" />
              </Button>
            )}
            <Button onClick={onBackToPath} variant="secondary" size="lg" className={cn(hasNext ? '' : 'flex-1')}>
              К карте пути
            </Button>
          </div>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted">
            <Sparkles className="size-3" />
            Завтра вернись — серия сохранится
          </p>
        </div>
      </Card>
    </div>
  )
}
