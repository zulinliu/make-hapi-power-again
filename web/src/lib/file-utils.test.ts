import { describe, it, expect } from 'vitest'
import { resolveImageMimeType, isBinaryContent, isMarkdownFile } from './file-utils'

describe('resolveImageMimeType', () => {
    it('returns null for empty string', () => {
        expect(resolveImageMimeType('')).toBeNull()
    })

    it('returns null for non-image extension', () => {
        expect(resolveImageMimeType('readme.txt')).toBeNull()
        expect(resolveImageMimeType('app.tsx')).toBeNull()
        expect(resolveImageMimeType('data.json')).toBeNull()
    })

    it('recognizes common image extensions', () => {
        expect(resolveImageMimeType('photo.png')).toBe('image/png')
        expect(resolveImageMimeType('photo.jpg')).toBe('image/jpeg')
        expect(resolveImageMimeType('photo.jpeg')).toBe('image/jpeg')
        expect(resolveImageMimeType('photo.gif')).toBe('image/gif')
        expect(resolveImageMimeType('photo.webp')).toBe('image/webp')
        expect(resolveImageMimeType('photo.svg')).toBe('image/svg+xml')
        expect(resolveImageMimeType('photo.bmp')).toBe('image/bmp')
        expect(resolveImageMimeType('photo.ico')).toBe('image/x-icon')
        expect(resolveImageMimeType('photo.avif')).toBe('image/avif')
    })

    it('is case-insensitive', () => {
        expect(resolveImageMimeType('Photo.PNG')).toBe('image/png')
        expect(resolveImageMimeType('Photo.Jpg')).toBe('image/jpeg')
    })

    it('handles paths with directories', () => {
        expect(resolveImageMimeType('/home/user/assets/logo.svg')).toBe('image/svg+xml')
        expect(resolveImageMimeType('src/components/icon.png')).toBe('image/png')
    })
})

describe('isBinaryContent', () => {
    it('returns false for empty string', () => {
        expect(isBinaryContent('')).toBe(false)
    })

    it('returns false for normal text', () => {
        expect(isBinaryContent('Hello, world!')).toBe(false)
    })

    it('returns false for text with tabs and newlines', () => {
        expect(isBinaryContent('line1\n\tline2\r\nline3')).toBe(false)
    })

    it('returns false for code with special chars', () => {
        expect(isBinaryContent('const x = "hello"; // comment\nif (x) { console.log(x); }')).toBe(false)
    })

    it('returns true for content with null bytes', () => {
        expect(isBinaryContent('hello\0world')).toBe(true)
    })

    it('returns true for content with many control chars', () => {
        const binary = Array.from({ length: 100 }, (_, i) => String.fromCharCode(i < 20 ? 1 : 65)).join('')
        expect(isBinaryContent(binary)).toBe(true)
    })

    it('returns false for normal code', () => {
        expect(isBinaryContent('function foo() {\n  return 42;\n}')).toBe(false)
    })
})

describe('isMarkdownFile', () => {
    it('returns true for .md files', () => {
        expect(isMarkdownFile('README.md')).toBe(true)
        expect(isMarkdownFile('guide.md')).toBe(true)
    })

    it('returns true for .mdx files', () => {
        expect(isMarkdownFile('blog.mdx')).toBe(true)
    })

    it('returns true for .markdown files', () => {
        expect(isMarkdownFile('CHANGELOG.markdown')).toBe(true)
    })

    it('is case-insensitive', () => {
        expect(isMarkdownFile('README.MD')).toBe(true)
        expect(isMarkdownFile('Guide.Md')).toBe(true)
    })

    it('returns false for non-markdown files', () => {
        expect(isMarkdownFile('readme.txt')).toBe(false)
        expect(isMarkdownFile('index.html')).toBe(false)
        expect(isMarkdownFile('app.tsx')).toBe(false)
    })

    it('handles paths with directories', () => {
        expect(isMarkdownFile('docs/README.md')).toBe(true)
        expect(isMarkdownFile('/home/user/notes.md')).toBe(true)
    })
})
