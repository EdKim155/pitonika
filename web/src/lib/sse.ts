export interface ChatBody {
  lessonId?: string
  stepId?: string
  code?: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}

export async function streamChat(
  body: ChatBody,
  handlers: {
    onDelta: (text: string) => void
    onReplace: (text: string) => void
    onError: (message: string) => void
    onDone: () => void
  },
  signal?: AbortSignal,
) {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!response.ok || !response.body) {
    let message = 'Наставник недоступен'
    try {
      const data = await response.json()
      message = data?.detail || message
    } catch {
      /* ignore */
    }
    handlers.onError(message)
    return
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part
        .split('\n')
        .map((item) => item.trim())
        .find((item) => item.startsWith('data:'))
      if (!line) continue
      try {
        const data = JSON.parse(line.slice(5).trim())
        if (data.error) handlers.onError(String(data.error))
        else if (data.replace) handlers.onReplace(String(data.delta || ''))
        else if (data.delta) handlers.onDelta(String(data.delta))
        if (data.done) handlers.onDone()
      } catch {
        /* ignore malformed frame */
      }
    }
  }
  handlers.onDone()
}
