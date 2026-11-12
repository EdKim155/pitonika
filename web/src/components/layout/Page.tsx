import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Page({
  children,
  className,
  width = 'wide',
}: {
  children: ReactNode
  className?: string
  width?: 'wide' | 'narrow'
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-6 md:px-8 md:py-8',
        width === 'wide' ? 'max-w-6xl' : 'max-w-3xl',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-primary-strong">{eyebrow}</p>
        )}
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight md:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
