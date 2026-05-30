import { useCallback, useEffect, useRef, useState } from 'react'
import { lazy, Suspense } from 'react'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
  java: 'java', kt: 'kotlin', swift: 'swift',
  c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp',
  cs: 'csharp', scala: 'scala', r: 'r',
  sql: 'sql', graphql: 'graphql',
  html: 'html', htm: 'html', xml: 'xml', svg: 'xml',
  css: 'css', scss: 'scss', less: 'less',
  json: 'json', yaml: 'yaml', yml: 'yaml',
  toml: 'ini', ini: 'ini', env: 'ini',
  md: 'markdown', mdx: 'markdown',
  sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  lua: 'lua', dart: 'dart', elixir: 'elixir',
  tf: 'hcl',
}

function detectLanguage(filename: string): string {
  const name = filename.toLowerCase()
  if (name === 'dockerfile') return 'dockerfile'
  if (name === 'makefile' || name === 'gnumakefile') return 'makefile'
  if (name === '.gitignore' || name === '.dockerignore') return 'ini'
  const ext = name.split('.').pop() ?? ''
  return LANGUAGE_MAP[ext] ?? 'plaintext'
}

interface CodeEditorProps {
  filename: string
  content: string
  readOnly?: boolean
  onSave?: (content: string) => void
  onChange?: (content: string) => void
}

export function CodeEditor({ filename, content, readOnly = false, onSave, onChange }: CodeEditorProps) {
  const language = detectLanguage(filename)
  const [modified, setModified] = useState(false)
  const contentRef = useRef(content)

  useEffect(() => {
    contentRef.current = content
    setModified(false)
  }, [content])

  const handleChange = useCallback((value: string | undefined) => {
    const newValue = value ?? ''
    contentRef.current = newValue
    setModified(newValue !== content)
    onChange?.(newValue)
  }, [content, onChange])

  const handleSave = useCallback(() => {
    if (!readOnly && modified) {
      onSave?.(contentRef.current)
      setModified(false)
    }
  }, [readOnly, modified, onSave])

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--hp-surface-0)' }}>
      <div className="flex items-center justify-between px-3 h-9 border-b shrink-0"
        style={{ borderColor: 'var(--hp-border)', background: 'var(--hp-surface-1)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono" style={{ color: 'var(--hp-text-secondary)' }}>
            {filename}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--hp-surface-2)', color: 'var(--hp-text-tertiary)' }}>
            {language}
          </span>
          {readOnly && (
            <span className="text-xs" style={{ color: 'var(--hp-warning)' }}>Read-only</span>
          )}
          {modified && !readOnly && (
            <span className="text-xs" style={{ color: 'var(--hp-primary)' }}>Modified</span>
          )}
        </div>
        {!readOnly && onSave && (
          <button
            onClick={handleSave}
            disabled={!modified}
            className="text-xs px-2 py-1 rounded font-medium"
            style={{
              background: modified ? 'var(--hp-primary)' : 'var(--hp-surface-2)',
              color: modified ? 'var(--hp-primary-text)' : 'var(--hp-text-tertiary)',
              cursor: modified ? 'pointer' : 'default',
            }}
          >
            Save (Ctrl+S)
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <Suspense fallback={<div className="p-4 text-sm" style={{ color: 'var(--hp-text-tertiary)' }}>Loading editor...</div>}>
          <MonacoEditor
            language={language}
            value={content}
            theme="vs-dark"
            onChange={handleChange}
            options={{
              readOnly,
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              padding: { top: 8 },
              renderLineHighlight: 'gutter',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              bracketPairColorization: { enabled: true },
            }}
            onMount={(editor, monaco) => {
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                handleSave()
              })
            }}
          />
        </Suspense>
      </div>
    </div>
  )
}
