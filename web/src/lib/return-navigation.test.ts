import { describe, expect, it } from 'vitest'
import { parseSafeReturnTo } from './return-navigation'

describe('parseSafeReturnTo', () => {
    it('accepts files return targets with machine and path search', () => {
        expect(parseSafeReturnTo('/files?machineId=m-1&path=L3JlcG8vc3Jj')).toEqual({
            type: 'files',
            search: {
                machineId: 'm-1',
                path: 'L3JlcG8vc3Jj',
            },
        })
    })

    it('accepts session files return targets', () => {
        expect(parseSafeReturnTo('/sessions/session-1/files?tab=directories')).toEqual({
            type: 'sessionFiles',
            sessionId: 'session-1',
            search: { tab: 'directories' },
        })
    })

    it('rejects external or unsupported return targets', () => {
        expect(parseSafeReturnTo('https://example.com/files')).toBeNull()
        expect(parseSafeReturnTo('//example.com/files')).toBeNull()
        expect(parseSafeReturnTo('/settings')).toBeNull()
    })
})
