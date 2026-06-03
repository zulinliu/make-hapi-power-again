import { useMemo } from 'react'
import { DiffEditor } from '@monaco-editor/react'

interface DiffViewProps {
    original: string
    modified: string
    language?: string
    filePath?: string
    readOnly?: boolean
    onChange?: (value: string) => void
}

interface DiffStats {
    added: number
    removed: number
    changedFiles: number
}

function computeStats(original: string, modified: string): DiffStats {
    const origLines = original.split('\n')
    const modLines = modified.split('\n')

    let added = 0
    let removed = 0
    const maxLen = Math.max(origLines.length, modLines.length)

    for (let i = 0; i < maxLen; i++) {
        const o = origLines[i]
        const m = modLines[i]
        if (o === undefined && m !== undefined) added++
        else if (m === undefined && o !== undefined) removed++
        else if (o !== m) { added++; removed++ }
    }

    return { added, removed, changedFiles: 1 }
}

const EXTENSION_MAP: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact',
    js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go',
    json: 'json', yaml: 'yaml', yml: 'yaml',
    md: 'markdown', css: 'css', html: 'html',
}

function resolveLanguage(path: string): string | undefined {
    const ext = path.split('.').pop()?.toLowerCase()
    if (!ext) return undefined
    return EXTENSION_MAP[ext] ?? ext
}

export function DiffView({ original, modified, language, filePath, readOnly }: DiffViewProps) {
    const lang = language ?? (filePath ? resolveLanguage(filePath) : undefined)
    const stats = useMemo(() => computeStats(original, modified), [original, modified])

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 px-3 py-1.5 border-b shrink-0 text-xs border-[var(--app-border)]">
                <span className="text-[var(--app-success)]">+{stats.added}</span>
                <span className="text-[var(--app-danger)]">-{stats.removed}</span>
                <span className="text-[var(--app-hint)]">{filePath}</span>
            </div>
            <div className="flex-1 min-h-0">
                <DiffEditor
                    height="100%"
                    language={lang}
                    original={original}
                    modified={modified}
                    theme="vs-dark"
                    options={{
                        readOnly: true,
                        renderSideBySide: true,
                        minimap: { enabled: false },
                        fontSize: 13,
                        scrollBeyondLastLine: false,
                        renderLineHighlight: 'gutter',
                        automaticLayout: true,
                        ignoreTrimWhitespace: false,
                    }}
                />
            </div>
        </div>
    )
}

export function DiffStatsBar({ stats }: { stats: DiffStats }) {
    return (
        <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-[var(--app-hint)]">
            <span>{stats.changedFiles} file{stats.changedFiles !== 1 ? 's' : ''}</span>
            <span className="text-[var(--app-success)]">+{stats.added}</span>
            <span className="text-[var(--app-danger)]">-{stats.removed}</span>
        </div>
    )
}
