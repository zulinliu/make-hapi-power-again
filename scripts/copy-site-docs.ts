import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const rootDir = join(import.meta.dir, '..')
const sourceDir = join(rootDir, 'docs')
const publicDir = join(rootDir, 'website', 'dist', 'public')
const targetDir = join(publicDir, 'docs')

if (!existsSync(sourceDir)) {
    throw new Error(`Docs source directory not found: ${sourceDir}`)
}

if (!targetDir.startsWith(publicDir)) {
    throw new Error(`Refusing to copy docs outside website public dir: ${targetDir}`)
}

mkdirSync(publicDir, { recursive: true })
rmSync(targetDir, { recursive: true, force: true })
cpSync(sourceDir, targetDir, { recursive: true })
writeFileSync(join(targetDir, 'index.html'), buildIndexHtml(listPublicDocs(sourceDir)), 'utf8')

function listPublicDocs(dir: string, base: string = dir): string[] {
    const entries = readdirSync(dir, { withFileTypes: true })
    const docs: string[] = []

    for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.name.startsWith('.')) continue

        if (entry.isDirectory()) {
            docs.push(...listPublicDocs(fullPath, base))
            continue
        }

        if (!entry.isFile()) continue
        if (!/\.(md|html)$/i.test(entry.name)) continue

        docs.push(relative(base, fullPath).split(sep).join('/'))
    }

    return docs.sort((a, b) => a.localeCompare(b))
}

function buildIndexHtml(docs: string[]): string {
    const links = docs
        .map((doc) => `<li><a href="/docs/${escapeHtml(doc)}">${escapeHtml(doc)}</a></li>`)
        .join('\n')

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hapi Power Docs</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 880px; margin: 0 auto; padding: 48px 24px; line-height: 1.6; color: #171717; }
    a { color: #d45500; text-decoration: none; }
    a:hover { text-decoration: underline; }
    ul { padding-left: 1.25rem; }
  </style>
</head>
<body>
  <h1>Hapi Power Docs</h1>
  <ul>
${links}
  </ul>
</body>
</html>
`
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}
