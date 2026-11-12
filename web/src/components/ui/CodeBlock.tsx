import { Highlight, themes } from 'prism-react-renderer'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useUI } from '@/store/ui'

export function CodeBlock({
  code,
  language = 'python',
  className,
  showLineNumbers = false,
  compact = false,
}: {
  code: string
  language?: string
  className?: string
  showLineNumbers?: boolean
  compact?: boolean
}) {
  const theme = useUI((state) => state.theme)
  const [copied, setCopied] = useState(false)
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const trimmed = code.replace(/\n$/, '')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(trimmed)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-line bg-[#0f1a16] text-[#e6efe9]',
        className,
      )}
    >
      <button
        onClick={copy}
        className="absolute right-2 top-2 z-10 rounded-md bg-white/10 p-1.5 text-white/70 opacity-0 transition hover:bg-white/20 hover:text-white group-hover:opacity-100"
        aria-label="Скопировать код"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
      <Highlight theme={isDark ? themes.vsDark : themes.nightOwl} code={trimmed} language={language}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className={cn('overflow-x-auto font-mono leading-relaxed', compact ? 'p-3 text-[12.5px]' : 'p-4 text-[13px]')}>
            <code>
              {tokens.map((line, index) => (
                <div key={index} {...getLineProps({ line })} className="table-row">
                  {showLineNumbers && (
                    <span className="table-cell select-none pr-4 text-right text-[11px] text-white/25">{index + 1}</span>
                  )}
                  <span className="table-cell">
                    {line.map((token, tokenIndex) => (
                      <span key={tokenIndex} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              ))}
            </code>
          </pre>
        )}
      </Highlight>
    </div>
  )
}
