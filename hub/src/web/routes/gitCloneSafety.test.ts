import { describe, expect, it } from 'bun:test'
import { GitCloneGate, parseGitCloneCancelRequest, parseGitCloneRequest } from './gitCloneSafety'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'

describe('gitCloneSafety', () => {
    it('accepts clone requests with an explicit cloneId', () => {
        const parsed = parseGitCloneRequest({
            url: 'https://github.com/zulinliu/make-hapi-power-again.git',
            targetDir: '/workspace',
            cloneId: VALID_UUID,
            depth: 1
        })

        expect(parsed.success).toBe(true)
        if (parsed.success) {
            expect(parsed.data.cloneId).toBe(VALID_UUID)
            expect(parsed.data.targetDir).toBe('/workspace')
        }
    })

    it('rejects embedded credentials, missing cloneId, and unsafe clone IDs', () => {
        expect(parseGitCloneRequest({
            url: 'https://user:pass@github.com/zulinliu/make-hapi-power-again.git',
            cloneId: VALID_UUID
        }).success).toBe(false)

        expect(parseGitCloneRequest({
            url: 'https://github.com/zulinliu/make-hapi-power-again.git'
        }).success).toBe(false)

        expect(parseGitCloneRequest({
            url: 'https://github.com/zulinliu/make-hapi-power-again.git',
            cloneId: '../../askpass.sh'
        }).success).toBe(false)
    })

    it('validates clone cancellation IDs from route params before RPC dispatch', () => {
        expect(parseGitCloneCancelRequest(VALID_UUID, null)).toEqual({
            success: true,
            data: { cloneId: VALID_UUID }
        })
        expect(parseGitCloneCancelRequest('../../bad', null).success).toBe(false)
    })

    it('enforces one active clone per scope until released', () => {
        const gate = new GitCloneGate()
        const first = gate.start('machine:machine-1', VALID_UUID)
        expect(first.ok).toBe(true)

        const second = gate.start('machine:machine-1', '22222222-2222-4222-8222-222222222222')
        expect(second).toEqual({
            ok: false,
            status: 409,
            error: 'Another git clone is already running for this scope'
        })

        if (first.ok) first.release()
        expect(gate.start('machine:machine-1', '22222222-2222-4222-8222-222222222222').ok).toBe(true)
    })
})
