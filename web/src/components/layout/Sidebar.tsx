import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  Folder,
  Map,
  RotateCcw,
  Settings,
  Target,
  Terminal,
  Zap,
} from 'lucide-react'
import { cn, plural } from '@/lib/utils'
import { Progress } from '@/components/ui/Progress'
import type { ProfileInfo } from '@/lib/types'
import { useUI } from '@/store/ui'

const items = [
  { to: '/path', label: 'Путь', icon: Map },
  { to: '/practice', label: 'Практика', icon: Target },
  { to: '/review', label: 'Повторение', short: 'Повтор', icon: RotateCcw, badgeKey: 'review' as const },
  { to: '/projects', label: 'Проекты', icon: Folder },
  { to: '/progress', label: 'Прогресс', icon: BarChart3 },
  { to: '/playground', label: 'Песочница', short: 'Код', icon: Terminal },
]

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-on-primary shadow-[0_6px_16px_-8px_rgba(14,159,110,0.8)]">
        <svg viewBox="0 0 32 32" className="size-5" fill="none" aria-hidden>
          <path
            d="M8 21c0-4.4 3.6-8 8-8h3a4 4 0 0 0 0-8h-2"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="9" cy="23" r="2.6" fill="currentColor" opacity="0.85" />
        </svg>
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-tight text-ink">Питоника</p>
          <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted">Python с нуля</p>
        </div>
      )}
    </div>
  )
}

export function Sidebar({
  profile,
  dueReviews,
  className,
}: {
  profile: ProfileInfo
  dueReviews: number
  className?: string
}) {
  const setSidebarOpen = useUI((state) => state.setSidebarOpen)
  const goalPercent = Math.min(100, Math.round((profile.xpToday / Math.max(1, profile.dailyGoalXp)) * 100))
  const remainingMinutes = Math.max(1, Math.ceil((profile.dailyGoalXp - profile.xpToday) / 4))

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-[236px] flex-col border-r border-line bg-surface px-3.5 py-4',
        className,
      )}
    >
      <div className="px-1.5">
        <Logo />
      </div>

      <nav className="mt-7 flex flex-1 flex-col gap-1" aria-label="Основная навигация">
        {items.map((item) => {
          const Icon = item.icon
          const badge = item.badgeKey === 'review' ? dueReviews : 0
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition',
                  isActive
                    ? 'bg-primary-soft text-primary-strong'
                    : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                )
              }
            >
              <Icon className="size-[18px]" strokeWidth={1.9} />
              <span className="flex-1">{item.label}</span>
              {badge > 0 && (
                <span className="flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[10.5px] font-bold text-[#3a2a00]">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="mt-4 rounded-2xl border border-line bg-surface-2/60 p-3.5">
        <div className="flex items-center justify-between">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">Цель дня</p>
          <span className="text-[11.5px] font-semibold text-ink">
            {profile.xpToday}/{profile.dailyGoalXp} XP
          </span>
        </div>
        <Progress value={goalPercent} className="mt-2 h-1.5" />
        <p className="mt-2 text-[11.5px] leading-snug text-muted">
          {profile.goalMet
            ? 'Цель закрыта. Молодец!'
            : goalPercent >= 60
              ? 'Ещё немного — и цель дня закрыта.'
              : `Осталось ~${remainingMinutes} ${plural(remainingMinutes, 'минута', 'минуты', 'минут')} — и готово.`}
        </p>
      </div>

      <NavLink
        to="/settings"
        onClick={() => setSidebarOpen(false)}
        className={({ isActive }) =>
          cn(
            'mt-2 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition',
            isActive ? 'bg-primary-soft text-primary-strong' : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
          )
        }
      >
        <Settings className="size-[18px]" strokeWidth={1.9} />
        Настройки
      </NavLink>
    </aside>
  )
}

export function MobileNav({ dueReviews }: { dueReviews: number }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-line bg-surface/95 px-2 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur md:hidden">
      {items.slice(0, 6).map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium',
                isActive ? 'text-primary-strong' : 'text-muted',
              )
            }
          >
            <Icon className="size-[19px]" strokeWidth={1.9} />
            <span className="max-w-full truncate">{('short' in item && item.short) || item.label}</span>
            {item.badgeKey === 'review' && dueReviews > 0 && (
              <span className="absolute right-[22%] top-0 size-1.5 rounded-full bg-accent" />
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

export function DailyStreakChip({ profile }: { profile: ProfileInfo }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12.5px] font-semibold text-ink">
      <Zap className="size-3.5 text-accent" />
      {profile.xpToday} <span className="text-muted">XP</span>
    </div>
  )
}

export function BookIcon() {
  return <BookOpen className="size-4" />
}
