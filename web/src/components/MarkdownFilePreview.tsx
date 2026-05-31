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
        <div className={`prose prose-sm max-w-none dark:prose-invert ${className ?? ''}`}>
            <ReactMarkdown remarkPlugins={plugins}>
                {content}
            </ReactMarkdown>
        </div>
    )
}
