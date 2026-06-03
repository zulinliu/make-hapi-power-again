import { useCallback, useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

interface CodeEditorProps {
    value: string
    language?: string
    filePath?: string
    readOnly?: boolean
    onChange?: (value: string) => void
    onSave?: (value: string) => void
}

const EXTENSION_MAP: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact',
    js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go',
    sql: 'sql', sh: 'shell', bash: 'shell',
    json: 'json', yaml: 'yaml', yml: 'yaml',
    md: 'markdown', css: 'css', scss: 'scss',
    html: 'html', xml: 'xml', dockerfile: 'dockerfile',
    toml: 'ini', ini: 'ini', env: 'ini',
    graphql: 'graphql', gql: 'graphql',
}

export function resolveLanguage(path: string): string | undefined {
    const name = path.split('/').pop()?.toLowerCase() ?? ''
    if (name === 'dockerfile') return 'dockerfile'
    if (name === 'makefile') return 'makefile'
    if (name === '.gitignore' || name === '.env') return 'ini'
    const ext = name.split('.').pop()
    if (!ext) return undefined
    return EXTENSION_MAP[ext] ?? ext
}

export function CodeEditor({ value, language, filePath, readOnly, onChange, onSave }: CodeEditorProps) {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
    const [dirty, setDirty] = useState(false)
    const [saving, setSaving] = useState(false)

    const lang = language ?? (filePath ? resolveLanguage(filePath) : undefined)

    const handleMount: OnMount = useCallback((editorInstance) => {
        editorRef.current = editorInstance
    }, [])

    const handleChange = useCallback((newValue: string | undefined) => {
        const v = newValue ?? ''
        if (v !== value) setDirty(true)
        onChange?.(v)
    }, [value, onChange])

    return (
        <div className="relative h-full">
            {(dirty || saving) && (
                <div className="absolute top-2 right-12 z-10 flex items-center gap-2 text-xs" style={{ color: 'var(--hp-text-tertiary)' }}>
                    {saving ? (
                        <span className="px-2 py-0.5 rounded" style={{ background: 'var(--hp-success-subtle)', color: 'var(--hp-success)' }}>
                            Saved
                        </span>
                    ) : dirty ? (
                        <span className="px-2 py-0.5 rounded" style={{ background: 'var(--hp-warning-subtle)', color: 'var(--hp-warning)' }}>
                            Modified
                        </span>
                    ) : null}
                </div>
            )}
            <Editor
                height="100%"
                language={lang}
                value={value}
                onChange={handleChange}
                onMount={handleMount}
                theme="vs-dark"
                options={{
                    readOnly,
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    padding: { top: 16, bottom: 16 },
                    renderLineHighlight: 'gutter',
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    bracketPairColorization: { enabled: true },
                    automaticLayout: true,
                }}
            />
        </div>
    )
}
