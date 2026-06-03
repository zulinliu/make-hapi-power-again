export const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
    apng: 'image/apng', avif: 'image/avif', bmp: 'image/bmp',
    gif: 'image/gif', ico: 'image/x-icon', jpeg: 'image/jpeg',
    jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml',
    tif: 'image/tiff', tiff: 'image/tiff', webp: 'image/webp'
}

export function resolveImageMimeType(path: string): string | null {
    const ext = path.split('.').pop()?.toLowerCase()
    if (!ext) return null
    return IMAGE_MIME_BY_EXTENSION[ext] ?? null
}

export function isBinaryContent(content: string): boolean {
    if (!content) return false
    if (content.includes('\0')) return true
    const sample = content.length > 8192 ? content.slice(0, 8192) : content
    const nonPrintable = sample.split('').filter((char) => {
        const code = char.charCodeAt(0)
        return code < 32 && code !== 9 && code !== 10 && code !== 13
    }).length
    return nonPrintable / sample.length > 0.1
}

export function isMarkdownFile(path: string): boolean {
    return /\.(md|mdx|markdown)$/i.test(path)
}
