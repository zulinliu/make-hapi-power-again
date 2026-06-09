import { describe, expect, it } from 'vitest'
import { hasGuideInterruptCapability } from './session-capabilities'

describe('hasGuideInterruptCapability', () => {
    it('requires all guide interrupt safety flags', () => {
        expect(hasGuideInterruptCapability({
            capabilities: {
                guideInterrupt: {
                    supported: true,
                    preservesQueue: true,
                    isolatedDelivery: true
                }
            }
        })).toBe(true)

        expect(hasGuideInterruptCapability({
            capabilities: {
                guideInterrupt: {
                    supported: true,
                    preservesQueue: false,
                    isolatedDelivery: true
                }
            }
        })).toBe(false)
    })

    it('treats missing metadata as unsupported', () => {
        expect(hasGuideInterruptCapability(null)).toBe(false)
        expect(hasGuideInterruptCapability({ capabilities: {} })).toBe(false)
    })
})
