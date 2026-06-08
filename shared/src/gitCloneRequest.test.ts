import { describe, expect, it } from 'bun:test'
import { GitCloneCancelRequestSchema, GitCloneRequestSchema } from './apiTypes'
import { CloneProgressDataSchema } from './schemas'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'

describe('GitCloneRequestSchema', () => {
    it('accepts production clone options for HTTPS repositories', () => {
        const parsed = GitCloneRequestSchema.safeParse({
            url: 'https://github.com/zulinliu/make-hapi-power-again.git',
            targetDir: '/workspace/projects',
            branch: 'feat/v0.17.3',
            depth: 1,
            cloneId: VALID_UUID,
            auth: { type: 'token', username: 'git', password: 'secret-token' }
        })

        expect(parsed.success).toBe(true)
    })

    it('accepts internal HTTP Git repositories with password authentication', () => {
        const parsed = GitCloneRequestSchema.safeParse({
            url: 'http://git.internal.example.com:8070/test-user/project/example-skill.git',
            targetDir: '/workspace/projects',
            cloneId: VALID_UUID,
            auth: { type: 'password', username: 'test-user', password: 'example-password' }
        })

        expect(parsed.success).toBe(true)
    })

    it('accepts SSH repository forms without embedded passwords', () => {
        expect(GitCloneRequestSchema.safeParse({
            url: 'git@github.com:zulinliu/make-hapi-power-again.git',
            cloneId: VALID_UUID,
            auth: { type: 'ssh' }
        }).success).toBe(true)

        expect(GitCloneRequestSchema.safeParse({
            url: 'ssh://git@github.com/zulinliu/make-hapi-power-again.git',
            cloneId: VALID_UUID,
            auth: { type: 'ssh' }
        }).success).toBe(true)
    })

    it('rejects clone IDs that cannot be safely used for progress and temp-file correlation', () => {
        expect(GitCloneRequestSchema.safeParse({
            url: 'https://github.com/zulinliu/make-hapi-power-again.git'
        }).success).toBe(false)

        const parsed = GitCloneRequestSchema.safeParse({
            url: 'https://github.com/zulinliu/make-hapi-power-again.git',
            cloneId: '../../tmp/pwned'
        })

        expect(parsed.success).toBe(false)
    })

    it('rejects non-git protocols and embedded credentials', () => {
        expect(GitCloneRequestSchema.safeParse({
            url: 'ftp://github.com/zulinliu/make-hapi-power-again.git',
            cloneId: VALID_UUID
        }).success).toBe(false)

        expect(GitCloneRequestSchema.safeParse({
            url: 'https://user:pass@github.com/zulinliu/make-hapi-power-again.git',
            cloneId: VALID_UUID
        }).success).toBe(false)

        expect(GitCloneRequestSchema.safeParse({
            url: 'http://user:pass@git.internal.example.com:8070/test-user/repo.git',
            cloneId: VALID_UUID
        }).success).toBe(false)

        expect(GitCloneRequestSchema.safeParse({
            url: 'ssh://git:pass@github.com/zulinliu/make-hapi-power-again.git',
            cloneId: VALID_UUID
        }).success).toBe(false)
    })

    it('rejects null bytes in user-controlled path-like fields', () => {
        expect(GitCloneRequestSchema.safeParse({
            url: 'https://github.com/zulinliu/make-hapi-power-again.git',
            targetDir: '/workspace\0evil',
            cloneId: VALID_UUID
        }).success).toBe(false)

        expect(GitCloneRequestSchema.safeParse({
            url: 'https://github.com/zulinliu/make-hapi-power-again.git',
            branch: 'main\0evil',
            cloneId: VALID_UUID
        }).success).toBe(false)
    })

    it('enforces destination contract and target directory name safety', () => {
        expect(GitCloneRequestSchema.safeParse({
            url: 'https://github.com/zulinliu/make-hapi-power-again.git',
            targetDir: '/workspace',
            targetName: 'make-hapi-power-again',
            cloneId: VALID_UUID
        }).success).toBe(true)

        expect(GitCloneRequestSchema.safeParse({
            url: 'https://github.com/zulinliu/make-hapi-power-again.git',
            targetDir: '/workspace',
            destinationPath: '/workspace/make-hapi-power-again',
            cloneId: VALID_UUID
        }).success).toBe(false)

        expect(GitCloneRequestSchema.safeParse({
            url: 'https://github.com/zulinliu/make-hapi-power-again.git',
            targetDir: '/workspace',
            targetName: '../escape',
            cloneId: VALID_UUID
        }).success).toBe(false)
    })

    it('rejects unknown fields and dangerous option-like values', () => {
        expect(GitCloneRequestSchema.safeParse({
            url: 'https://github.com/zulinliu/make-hapi-power-again.git',
            targetDir: '/workspace',
            cloneId: VALID_UUID,
            cwd: '/tmp'
        }).success).toBe(false)

        expect(GitCloneRequestSchema.safeParse({
            url: 'https://github.com/zulinliu/make-hapi-power-again.git',
            branch: '-upload-pack=/tmp/pwn',
            cloneId: VALID_UUID
        }).success).toBe(false)

        for (const targetName of ['.', '..', '-repo']) {
            expect(GitCloneRequestSchema.safeParse({
                url: 'https://github.com/zulinliu/make-hapi-power-again.git',
                targetName,
                cloneId: VALID_UUID
            }).success).toBe(false)
        }

        for (const depth of [0, -1, 1_000_001]) {
            expect(GitCloneRequestSchema.safeParse({
                url: 'https://github.com/zulinliu/make-hapi-power-again.git',
                depth,
                cloneId: VALID_UUID
            }).success).toBe(false)
        }
    })

    it('rejects branch whitespace before the value reaches git arguments', () => {
        for (const branch of [' main', 'main ', 'feature branch', 'main\nnext', 'main\tnext']) {
            expect(GitCloneRequestSchema.safeParse({
                url: 'https://github.com/zulinliu/make-hapi-power-again.git',
                branch,
                cloneId: VALID_UUID
            }).success).toBe(false)
        }
    })

    it('enforces authentication mode semantics', () => {
        expect(GitCloneRequestSchema.safeParse({
            url: 'https://github.com/zulinliu/make-hapi-power-again.git',
            cloneId: VALID_UUID,
            auth: { type: 'token' }
        }).success).toBe(false)

        expect(GitCloneRequestSchema.safeParse({
            url: 'https://github.com/zulinliu/make-hapi-power-again.git',
            cloneId: VALID_UUID,
            auth: { type: 'password', username: 'git' }
        }).success).toBe(false)

        expect(GitCloneRequestSchema.safeParse({
            url: 'git@github.com:zulinliu/make-hapi-power-again.git',
            cloneId: VALID_UUID,
            auth: { type: 'ssh', password: 'not-allowed' }
        }).success).toBe(false)

        expect(GitCloneRequestSchema.safeParse({
            url: 'https://github.com/zulinliu/make-hapi-power-again.git',
            cloneId: VALID_UUID,
            auth: { type: 'ssh' }
        }).success).toBe(false)

        expect(GitCloneRequestSchema.safeParse({
            url: 'git@github.com:zulinliu/make-hapi-power-again.git',
            cloneId: VALID_UUID,
            auth: { type: 'token', password: 'secret-token' }
        }).success).toBe(false)

        expect(GitCloneRequestSchema.safeParse({
            url: 'ssh://git@github.com/zulinliu/make-hapi-power-again.git',
            cloneId: VALID_UUID,
            auth: { type: 'password', username: 'git', password: 'secret-password' }
        }).success).toBe(false)
    })

    it('validates clone cancellation requests strictly', () => {
        expect(GitCloneCancelRequestSchema.safeParse({ cloneId: VALID_UUID }).success).toBe(true)
        expect(GitCloneCancelRequestSchema.safeParse({ cloneId: '../../bad' }).success).toBe(false)
        expect(GitCloneCancelRequestSchema.safeParse({ cloneId: VALID_UUID, extra: true }).success).toBe(false)
    })
})

describe('CloneProgressDataSchema', () => {
    it('requires exactly one authenticated progress scope', () => {
        expect(CloneProgressDataSchema.safeParse({
            cloneId: VALID_UUID,
            sessionId: 'session-1',
            phase: 'writing',
            progress: 42
        }).success).toBe(true)

        expect(CloneProgressDataSchema.safeParse({
            cloneId: VALID_UUID,
            machineId: 'machine-1',
            phase: 'done',
            progress: 100
        }).success).toBe(true)

        expect(CloneProgressDataSchema.safeParse({
            cloneId: VALID_UUID,
            phase: 'writing',
            progress: 42
        }).success).toBe(false)

        expect(CloneProgressDataSchema.safeParse({
            cloneId: VALID_UUID,
            sessionId: 'session-1',
            machineId: 'machine-1',
            phase: 'writing',
            progress: 42
        }).success).toBe(false)
    })
})
