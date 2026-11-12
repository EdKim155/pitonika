import { create } from 'zustand'
import { Check, Info, TriangleAlert, Trophy, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'success' | 'info' | 'error' | 'achievement'

interface ToastItem {
  id: number
  tone: Tone
  title: string
  description?: string
}

interface ToastState {
  items: ToastItem[]
  push: (toast: Omit<ToastItem, 'id'>) => void
  remove: (id: number) => void
}

let counter = 1

export const useToast = create<ToastState>((set) => ({
  items: [],
  push: (toast) => {
    const id = counter++
    set((state) => ({ items: [...state.items.slice(-2), { ...toast, id }] }))
    window.setTimeout(() => {
      set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
    }, 4200)
  },
  remove: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
}))

const tones: Record<Tone, { icon: typeof Check; className: string }> = {
  success: { icon: Check, className: 'border-primary/25 bg-surface' },
  info: { icon: Info, className: 'border-info/25 bg-surface' },
  error: { icon: TriangleAlert, className: 'border-danger/25 bg-surface' },
  achievement: { icon: Trophy, className: 'border-accent/40 bg-surface' },
}

export function Toaster() {
  const items = useToast((state) => state.items)
  const remove = useToast((state) => state.remove)
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[320px] flex-col gap-2">
      {items.map((item) => {
        const { icon: Icon, className } = tones[item.tone]
        return (
          <div
            key={item.id}
            className={cn(
              'animate-float-up pointer-events-auto flex items-start gap-3 rounded-2xl border p-3.5 shadow-lift',
              className,
            )}
            role="status"
          >
            <div
              className={cn(
                'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
                item.tone === 'achievement' ? 'bg-accent-soft text-accent' : 'bg-primary-soft text-primary-strong',
              )}
            >
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-ink">{item.title}</p>
              {item.description && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{item.description}</p>}
            </div>
            <button onClick={() => remove(item.id)} className="text-muted transition hover:text-ink" aria-label="Закрыть">
              <X className="size-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
