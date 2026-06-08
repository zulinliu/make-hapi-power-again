#!/usr/bin/env bun

import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const ALLOWED_AUTHOR_NAME = 'zulinliu'
const VERSION_TAG_PATTERN = /^v[0-9]+\.[0-9]+\.[0-9]+$/
const FEATURE_BRANCH_PATTERN = /^feat\/v[0-9]+\.[0-9]+\.[0-9]+$/
const ALLOWED_BRANCH_NAMES = new Set(['main', 'dev'])
const FORBIDDEN_TEXT_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
    { label: 'Co-Authored-By', pattern: /^\s*Co-Authored-By:/im },
    { label: 'via credit', pattern: /^\s*via \[(?:HAPI|HapiPower|Claude Code)\]/im },
    { label: 'hapi.run', pattern: /hapi\.run/i },
    { label: 'Generated with Claude Code', pattern: /Generated with \[Claude Code\]/i }
]

type Options = {
    commitMsgFile?: string
    releaseNotesFile?: string
}

function parseArgs(argv: string[]): Options {
    const options: Options = {}
    for (let index = 2; index < argv.length; index += 1) {
        const arg = argv[index]
        if ((arg === '--commit-msg' || arg === '--commit-msg-file') && argv[index + 1]) {
            options.commitMsgFile = argv[index + 1]
            index += 1
            continue
        }
        if ((arg === '--release-notes' || arg === '--release-notes-file') && argv[index + 1]) {
            options.releaseNotesFile = argv[index + 1]
            index += 1
        }
    }
    return options
}

function fail(message: string): never {
    console.error(`[git-standards] ${message}`)
    process.exit(1)
}

function git(args: string[]): string | null {
    const result = spawnSync('git', args, { encoding: 'utf8' })
    if (result.status !== 0) {
        return null
    }
    return result.stdout.trim()
}

function checkText(label: string, text: string): void {
    for (const { label: patternLabel, pattern } of FORBIDDEN_TEXT_PATTERNS) {
        if (pattern.test(text)) {
            fail(`${label} contains forbidden marker: ${patternLabel}`)
        }
    }
}

function checkFile(label: string, path: string): void {
    if (!existsSync(path)) {
        fail(`${label} file does not exist: ${path}`)
    }
    checkText(label, readFileSync(path, 'utf8'))
}

function readCurrentBranch(): string | null {
    if (process.env.GITHUB_REF_TYPE === 'branch' && process.env.GITHUB_REF_NAME) {
        return process.env.GITHUB_REF_NAME
    }
    if (process.env.GITHUB_REF?.startsWith('refs/heads/')) {
        return process.env.GITHUB_REF.slice('refs/heads/'.length)
    }
    return git(['branch', '--show-current'])
}

function readCurrentTag(): string | null {
    if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME) {
        return process.env.GITHUB_REF_NAME
    }
    if (process.env.GITHUB_REF?.startsWith('refs/tags/')) {
        return process.env.GITHUB_REF.slice('refs/tags/'.length)
    }
    return git(['describe', '--tags', '--exact-match', 'HEAD'])
}

function readNameFromIdent(ident: string | null): string | null {
    if (!ident) {
        return null
    }
    const match = ident.match(/^(.*?)\s+</)
    return match?.[1]?.trim() || null
}

function checkBranchName(): void {
    const branch = readCurrentBranch()
    if (!branch || branch === 'HEAD') {
        return
    }
    if (ALLOWED_BRANCH_NAMES.has(branch) || FEATURE_BRANCH_PATTERN.test(branch)) {
        return
    }
    fail(`branch name must be main, dev, or feat/vX.Y.Z: ${branch}`)
}

function checkTagNameAndTagger(): void {
    const tag = readCurrentTag()
    if (!tag) {
        return
    }
    if (!VERSION_TAG_PATTERN.test(tag)) {
        fail(`tag must use vX.Y.Z format: ${tag}`)
    }

    const taggerName = git(['for-each-ref', `refs/tags/${tag}`, '--format=%(taggername)'])
    if (taggerName && taggerName !== ALLOWED_AUTHOR_NAME) {
        fail(`tagger must be ${ALLOWED_AUTHOR_NAME}, got ${taggerName}`)
    }
}

function checkPendingCommitAuthor(): void {
    const authorName = readNameFromIdent(git(['var', 'GIT_AUTHOR_IDENT']))
    if (authorName && authorName !== ALLOWED_AUTHOR_NAME) {
        fail(`commit author must be ${ALLOWED_AUTHOR_NAME}, got ${authorName}`)
    }
}

function checkHeadCommit(): void {
    const authorName = git(['log', '-1', '--format=%an'])
    if (authorName && authorName !== ALLOWED_AUTHOR_NAME) {
        fail(`HEAD author must be ${ALLOWED_AUTHOR_NAME}, got ${authorName}`)
    }

    const committerName = git(['log', '-1', '--format=%cn'])
    if (committerName && committerName !== ALLOWED_AUTHOR_NAME) {
        fail(`HEAD committer must be ${ALLOWED_AUTHOR_NAME}, got ${committerName}`)
    }

    const message = git(['log', '-1', '--format=%B'])
    if (message) {
        checkText('HEAD commit message', message)
    }
}

function main(): void {
    const options = parseArgs(process.argv)

    checkBranchName()
    checkTagNameAndTagger()
    checkHeadCommit()

    if (options.commitMsgFile) {
        checkFile('commit message', options.commitMsgFile)
        checkPendingCommitAuthor()
    }

    if (options.releaseNotesFile) {
        checkFile('release notes', options.releaseNotesFile)
    }
}

main()
