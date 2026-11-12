import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function StepFrame({
  label,
  title,
  children,
  footer,
  wide = false,
}: {
  label: string
  title?: string | null
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  return (
    <div className={cn('rounded-3xl border border-line bg-surface p-5 shadow-soft sm:p-7', wide && 'sm:p-6')}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      {title && <h2 className="mt-1.5 text-[20px] font-semibold leading-tight tracking-tight sm:text-[22px]">{title}</h2>}
      <div className="mt-4">{children}</div>
      {footer && <div className="mt-6 flex flex-wrap items-center gap-2">{footer}</div>}
    </div>
  )
}

export function Aside({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'accent' }) {
  return (
    <div
      className={cn(
        'mt-4 rounded-xl border px-3.5 py-3 text-[12.5px] leading-relaxed',
        tone === 'info'
          ? 'border-info/25 bg-info-soft/60 text-info'
          : 'border-accent/35 bg-accent-soft/70 text-[#7a5a00] dark:text-accent',
      )}
    >
      {children}
    </div>
  )
}
