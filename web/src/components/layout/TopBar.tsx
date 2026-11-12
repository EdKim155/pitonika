import { Link, useLocation } from 'react-router-dom'
import { Flame, Menu, Moon, Settings, Sparkles, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Ring } from '@/components/ui/Progress'
import { useUI } from '@/store/ui'
import type { ProfileInfo } from '@/lib/types'

export function TopBar({ profile }: { profile: ProfileInfo }) {
  const theme = useUI((state) => state.theme)
  const setTheme = useUI((state) => state.setTheme)
  const toggleAi = useUI((state) => state.toggleAi)
  const aiOpen = useUI((state) => state.aiOpen)
  const setSidebarOpen = useUI((state) => state.setSidebarOpen)
  const location = useLocation()

  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const level = profile.level

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-paper/85 px-3 backdrop-blur-md md:px-6">
      <button
        className="rounded-lg p-2 text-ink-soft transition hover:bg-surface-2 md:hidden"
        onClick={() => setSidebarOpen(true)}
        aria-label="Меню"
      >
        <Menu className="size-5" />
      </button>

      <div className="hidden items-center gap-2 text-[12.5px] text-muted md:flex">
        <span>Питоника</span>
        <span className="text-line-strong">/</span>
        <span className="font-medium text-ink-soft">
          {location.pathname.startsWith('/lesson')
            ? 'Урок'
            : location.pathname === '/path'
              ? 'Путь'
              : location.pathname === '/progress'
                ? 'Прогресс'
                : location.pathname === '/settings'
                  ? 'Настройки'
                  : location.pathname === '/review'
                    ? 'Повторение'
                    : location.pathname === '/practice'
                      ? 'Практика'
                      : location.pathname === '/playground'
                        ? 'Песочница'
                        : location.pathname === '/projects'
                          ? 'Проекты'
                          : 'Обучение'}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1.5 md:gap-2">
        <div
          className="flex items-center gap-1 rounded-full border border-accent/30 bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-[#7a5a00] dark:text-accent"
          title={`Серия: ${profile.streak.current} дн. Лучшая: ${profile.streak.best}`}
        >
          <Flame className="size-3.5" />
          {profile.streak.current}
        </div>

        <div className="flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] font-semibold">
          <span className="text-primary-strong">{profile.xpToday}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted">xp</span>
        </div>

        <Link
          to="/progress"
          className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 transition hover:border-line-strong"
          title={`${level.title} · ${level.xp} XP`}
        >
          <Ring value={level.percent} size={26} stroke={3}>
            <span className="text-[10px] font-bold">{level.level}</span>
          </Ring>
          <span className="hidden text-[12px] font-medium text-ink-soft sm:block">{level.title}</span>
        </Link>

        <button
          className="hidden rounded-lg p-2 text-ink-soft transition hover:bg-surface-2 sm:block"
          onClick={() => setTheme(nextTheme)}
          aria-label="Сменить тему"
          title="Сменить тему"
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>

        <button
          onClick={toggleAi}
          className={cn(
            'flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12.5px] font-semibold transition',
            aiOpen
              ? 'bg-primary text-on-primary'
              : 'border border-line bg-surface text-ink-soft hover:border-primary/40 hover:text-primary-strong',
          )}
          aria-pressed={aiOpen}
        >
          <Sparkles className="size-3.5" />
          <span className="hidden sm:inline">Наставник</span>
        </button>

        <Link
          to="/settings"
          className="rounded-lg p-2 text-ink-soft transition hover:bg-surface-2"
          aria-label="Настройки"
        >
          <Settings className="size-4" />
        </Link>
      </div>
    </header>
  )
}
