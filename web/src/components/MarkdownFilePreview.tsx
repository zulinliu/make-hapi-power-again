import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownFilePreviewProps {
    content: string
    className?: string
}

export function MarkdownFilePreview({ content, className }: MarkdownFilePreviewProps) {
    const plugins = useMemo(() => [remarkGfm], [])

    return (
        <div
            className={`prose prose-sm max-w-none ${className ?? ''}`}
            style={{
                color: 'var(--app-fg)',
                // prose overrides for consistent theming
                '--tw-prose-body': 'var(--app-fg)',
                '--tw-prose-headings': 'var(--app-fg)',
                '--tw-prose-links': 'var(--app-link)',
                '--tw-prose-code': 'var(--app-fg)',
                '--tw-prose-pre-bg': 'var(--app-subtle-bg)',
                '--tw-prose-pre-code': 'var(--app-fg)',
                '--tw-prose-quotes': 'var(--app-hint)',
                '--tw-prose-counters': 'var(--app-hint)',
                '--tw-prose-bullets': 'var(--app-hint)',
                '--tw-prose-hr': 'var(--app-divider)',
                '--tw-prose-th-borders': 'var(--app-divider)',
                '--tw-prose-td-borders': 'var(--app-divider)',
            } as React.CSSProperties}
        >
            <ReactMarkdown remarkPlugins={plugins}>
                {content}
            </ReactMarkdown>
        </div>
    )
}
