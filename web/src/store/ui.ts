import { create } from 'zustand'

type Theme = 'light' | 'dark' | 'system'

export interface AiContext {
  lessonId?: string
  stepId?: string
  code?: string
  stderr?: string
  title?: string
}

interface UIState {
  theme: Theme
  setTheme: (theme: Theme) => void
  aiOpen: boolean
  setAiOpen: (open: boolean) => void
  toggleAi: () => void
  aiContext: AiContext
  setAiContext: (context: AiContext) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

export const useUI = create<UIState>((set, get) => ({
  theme: (localStorage.getItem('pitonika-theme') as Theme) || 'light',
  setTheme: (theme) => {
    localStorage.setItem('pitonika-theme', theme)
    applyTheme(theme)
    set({ theme })
  },
  aiOpen: localStorage.getItem('pitonika-ai') === '1',
  setAiOpen: (open) => {
    localStorage.setItem('pitonika-ai', open ? '1' : '0')
    set({ aiOpen: open })
  },
  toggleAi: () => {
    const next = !get().aiOpen
    localStorage.setItem('pitonika-ai', next ? '1' : '0')
    set({ aiOpen: next })
  },
  aiContext: {},
  setAiContext: (aiContext) => set({ aiContext }),
  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}))

export function initTheme() {
  const theme = (localStorage.getItem('pitonika-theme') as Theme) || 'light'
  applyTheme(theme)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useUI.getState().theme === 'system') applyTheme('system')
  })
}
