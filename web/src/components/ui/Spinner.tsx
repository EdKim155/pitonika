import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn('size-5 animate-spin rounded-full border-2 border-line border-t-primary', className)}
      role="status"
      aria-label="Загрузка"
    />
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-2', className)} />
}
