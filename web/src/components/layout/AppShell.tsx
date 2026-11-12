import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Bootstrap } from '@/lib/types'
import { Sidebar, MobileNav } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { AiPanel } from '@/components/ai/AiPanel'
import { Spinner } from '@/components/ui/Spinner'
import { useUI } from '@/store/ui'
import { cn } from '@/lib/utils'

export function useBootstrap() {
  return useQuery({
    queryKey: ['bootstrap'],
    queryFn: () => api.get<Bootstrap>('/api/bootstrap'),
    staleTime: 20_000,
  })
}

export function AppShell() {
  const { data, isLoading, error } = useBootstrap()
  const aiOpen = useUI((state) => state.aiOpen)
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6">
        <div className="max-w-md rounded-2xl border border-danger/30 bg-surface p-6 text-center shadow-soft">
          <h1 className="text-lg font-semibold">Не удалось загрузить приложение</h1>
          <p className="mt-2 text-sm text-muted">
            Проверь, что бэкенд запущен на порту 8420, и обнови страницу.
          </p>
          <p className="mt-3 rounded-lg bg-surface-2 p-2 font-mono text-[11px] text-muted">
            {error instanceof Error ? error.message : 'Неизвестная ошибка'}
          </p>
        </div>
      </div>
    )
  }

  if (!data.profile.onboarded && location.pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />
  }

  return (
    <div className="min-h-screen bg-paper">
      <Sidebar profile={data.profile} dueReviews={data.dueReviews} className="hidden md:flex" />
      <MobileNav dueReviews={data.dueReviews} />
      <div
        className={cn(
          'flex min-h-screen flex-col md:pl-[236px]',
          aiOpen && 'xl:pr-[400px]',
        )}
      >
        <TopBar profile={data.profile} />
        <main className="flex-1 pb-20 md:pb-8">
          <Outlet context={data} />
        </main>
      </div>
      {aiOpen && <AiPanel />}
    </div>
  )
}
