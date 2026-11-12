import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from '@/components/ui/CodeBlock'

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={className ?? 'prose-pitonika'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { children: content, className: codeClassName } = props
            const match = /language-(\w+)/.exec(codeClassName || '')
            if (match) {
              return <CodeBlock code={String(content).replace(/\n$/, '')} language={match[1]} compact className="my-3" />
            }
            if (typeof content === 'string' && content.includes('\n')) {
              return <CodeBlock code={content.replace(/\n$/, '')} compact className="my-3" />
            }
            return <code>{content}</code>
          },
          pre(props) {
            return <>{props.children}</>
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
