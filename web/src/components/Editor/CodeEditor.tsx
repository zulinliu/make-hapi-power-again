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
    const valueRef = useRef(value)
    valueRef.current = value

    const lang = language ?? (filePath ? resolveLanguage(filePath) : undefined)

    const handleMount: OnMount = useCallback((editorInstance) => {
        editorRef.current = editorInstance
        // Bind Ctrl+S / Cmd+S to save (KeyMod.CtrlCmd=2048, KeyCode.KeyS=49)
        editorInstance.addCommand(2048 | 49, () => {
            const current = editorRef.current?.getValue() ?? ''
            onSave?.(current)
        })
    }, [onSave])

    const handleChange = useCallback((newValue: string | undefined) => {
        const v = newValue ?? ''
        if (v !== valueRef.current) setDirty(true)
        onChange?.(v)
    }, [onChange])

    const handleSave = useCallback(async () => {
        if (!onSave || !dirty || saving) return
        const current = editorRef.current?.getValue() ?? ''
        setSaving(true)
        try {
            await onSave(current)
            setDirty(false)
        } finally {
            setSaving(false)
        }
    }, [onSave, dirty, saving])

    return (
        <div className="relative h-full">
            {(dirty || saving) && (
                <div className="absolute top-2 right-12 z-10 flex items-center gap-2 text-xs text-[var(--app-hint)]">
                    {saving ? (
                        <span className="px-2 py-0.5 rounded text-[var(--app-success)] bg-[var(--app-success-subtle)]">
                            Saved
                        </span>
                    ) : dirty ? (
                        <button
                            type="button"
                            onClick={handleSave}
                            className="px-2 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity text-[var(--app-warning)] bg-[var(--app-warning-subtle)]"
                        >
                            Modified · Save
                        </button>
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
                loading={
                    <div className="flex items-center justify-center h-full" style={{ background: '#1e1e1e', color: '#888' }}>
                        <span className="text-sm">Loading editor...</span>
                    </div>
                }
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
                    scrollbar: {
                        verticalScrollbarSize: 8,
                        horizontalScrollbarSize: 8,
                    },
                }}
            />
        </div>
    )
}
