import Editor, { loader } from '@monaco-editor/react'
import { useUI } from '@/store/ui'
import { Spinner } from '@/components/ui/Spinner'

loader.config({ paths: { vs: '/monaco/vs' } })

export function PythonEditor({
  value,
  onChange,
  onRun,
  height = 300,
  readOnly = false,
}: {
  value: string
  onChange: (value: string) => void
  onRun?: () => void
  height?: number
  readOnly?: boolean
}) {
  const theme = useUI((state) => state.theme)
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-[#0f1a16]">
      <Editor
        height={height}
        language="python"
        theme={dark ? 'vs-dark' : 'light'}
        value={value}
        loading={
          <div className="flex h-full items-center justify-center gap-2 bg-surface text-[12px] text-muted">
            <Spinner className="size-4" /> Загружаю редактор…
          </div>
        }
        onChange={(next) => onChange(next ?? '')}
        onMount={(editor, monaco) => {
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRun?.())
          editor.updateOptions({ tabSize: 4 })
        }}
        options={{
          readOnly,
          fontFamily: 'JetBrains Mono Variable, ui-monospace, monospace',
          fontSize: 13.5,
          lineHeight: 22,
          minimap: { enabled: false },
          lineNumbers: 'on',
          glyphMargin: false,
          folding: false,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: 'line',
          cursorBlinking: 'smooth',
          smoothScrolling: true,
          wordWrap: 'on',
          tabSize: 4,
          insertSpaces: true,
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          contextmenu: true,
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          guides: { indentation: false },
          renderWhitespace: 'selection',
        }}
      />
    </div>
  )
}
