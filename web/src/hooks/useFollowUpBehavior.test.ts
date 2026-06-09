import { beforeEach, describe, expect, it } from 'vitest'
import {
    DEFAULT_FOLLOW_UP_BEHAVIOR,
    getFollowUpBehaviorOptions,
    getInitialFollowUpBehavior,
} from './useFollowUpBehavior'

describe('useFollowUpBehavior helpers', () => {
    beforeEach(() => {
        window.localStorage.clear()
    })

    it('returns the allowed follow-up behavior options', () => {
        expect(getFollowUpBehaviorOptions()).toEqual([
            { value: 'queue', labelKey: 'settings.chat.followUpBehavior.queue' },
            { value: 'guide', labelKey: 'settings.chat.followUpBehavior.guide' },
        ])
    })

    it('falls back to queue for missing or invalid storage values', () => {
        expect(getInitialFollowUpBehavior()).toBe(DEFAULT_FOLLOW_UP_BEHAVIOR)

        window.localStorage.setItem('hapi-power-follow-up-behavior', 'invalid')
        expect(getInitialFollowUpBehavior()).toBe(DEFAULT_FOLLOW_UP_BEHAVIOR)
    })

    it('reads a valid stored follow-up behavior', () => {
        window.localStorage.setItem('hapi-power-follow-up-behavior', 'guide')

        expect(getInitialFollowUpBehavior()).toBe('guide')
    })
})
