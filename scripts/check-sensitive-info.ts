#!/usr/bin/env bun

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

type Finding = {
    file: string
    line: number
    label: string
    excerpt: string
}

const ROOTS = [
    'AGENTS.md',
    'GIT-STANDARDS.md',
    '.github',
    '.planning',
    '.understand-anything',
    'cli/scripts',
    'cli/src',
    'docs',
    'hub/src',
    'scripts',
    'shared/src',
    'web/src',
    'website/public',
    'website/src'
]

const SKIP_DIRS = new Set([
    '.git',
    'dist',
    'node_modules',
    'release-artifacts'
])

const TEXT_EXTENSIONS = new Set([
    '.cjs',
    '.css',
    '.html',
    '.js',
    '.json',
    '.jsx',
    '.md',
    '.mjs',
    '.sh',
    '.ts',
    '.tsx',
    '.txt',
    '.yml',
    '.yaml',
    '.xml'
])

const CHECKS: Array<{ label: string; pattern: RegExp }> = [
    {
        label: 'personal/internal marker',
        pattern: /liuzl|liuzulin|git\.tsintergy\.com|test\.liuzl\.asia|hapi-power\.liuzl\.asia|\/home\/liuzl|172\.30\.1\.63|172\.18\.83\.102/i
    },
    {
        label: 'high-confidence secret prefix',
        pattern: /sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[0-9A-Za-z-]{20,}|hf_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/
    },
    {
        label: 'URL embedded credentials',
        pattern: /https?:\/\/[^/\s:@]+:[^@\s]+@/i
    }
]

function isTextFile(path: string): boolean {
    const lower = path.toLowerCase()
    if (lower.endsWith('license') || lower.endsWith('dockerfile')) {
        return true
    }

    const dotIndex = lower.lastIndexOf('.')
    if (dotIndex === -1) {
        return false
    }
    return TEXT_EXTENSIONS.has(lower.slice(dotIndex))
}

function walk(path: string, files: string[]): void {
    const stats = statSync(path)
    if (stats.isDirectory()) {
        const name = path.split(/[\\/]/).pop()
        if (name && SKIP_DIRS.has(name)) {
            return
        }
        for (const child of readdirSync(path)) {
            walk(join(path, child), files)
        }
        return
    }

    if (stats.isFile() && isTextFile(path)) {
        files.push(path)
    }
}

function isAllowedUrlUserinfoExample(file: string): boolean {
    const normalized = file.replace(/\\/g, '/')
    return /\.test\.tsx?$/.test(normalized)
        || normalized.endsWith('SECURITY-ADDENDUM.md')
}

function isAllowedFinding(file: string, label: string): boolean {
    if (file.replace(/\\/g, '/') === 'scripts/check-sensitive-info.ts') {
        return true
    }
    if (label === 'URL embedded credentials') {
        return isAllowedUrlUserinfoExample(file)
    }
    return false
}

function collectFiles(): string[] {
    const files: string[] = []
    for (const root of ROOTS) {
        try {
            walk(join(process.cwd(), root), files)
        } catch {
            // Optional roots can be absent in partial checkouts.
        }
    }
    return files
}

function main(): void {
    const findings: Finding[] = []

    for (const filePath of collectFiles()) {
        const relativePath = relative(process.cwd(), filePath)
        const content = readFileSync(filePath, 'utf8')
        const lines = content.split(/\r?\n/)

        lines.forEach((line, index) => {
            for (const check of CHECKS) {
                check.pattern.lastIndex = 0
                if (!check.pattern.test(line) || isAllowedFinding(relativePath, check.label)) {
                    continue
                }
                findings.push({
                    file: relativePath,
                    line: index + 1,
                    label: check.label,
                    excerpt: line.trim().slice(0, 180)
                })
            }
        })
    }

    if (findings.length === 0) {
        return
    }

    console.error('[sensitive-info] Found sensitive information candidates:')
    for (const finding of findings) {
        console.error(`${finding.file}:${finding.line} [${finding.label}] ${finding.excerpt}`)
    }
    process.exit(1)
}

main()
