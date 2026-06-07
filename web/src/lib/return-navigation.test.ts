import { describe, expect, it } from 'vitest'
import { parseSafeReturnTo } from './return-navigation'

describe('parseSafeReturnTo', () => {
    it('accepts browse return targets with machine and path search', () => {
        expect(parseSafeReturnTo('/browse?machineId=m-1&path=L3JlcG8vc3Jj')).toEqual({
            type: 'browse',
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
        expect(parseSafeReturnTo('https://example.com/browse')).toBeNull()
        expect(parseSafeReturnTo('//example.com/browse')).toBeNull()
        expect(parseSafeReturnTo('/settings')).toBeNull()
    })
})
