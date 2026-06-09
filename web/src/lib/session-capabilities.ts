import type { SessionMetadataSummary } from '@/types/api'

export function hasGuideInterruptCapability(
    metadata: Pick<SessionMetadataSummary, 'capabilities'> | null | undefined
): boolean {
    const guide = metadata?.capabilities?.guideInterrupt
    return guide?.supported === true
        && guide.preservesQueue === true
        && guide.isolatedDelivery === true
}
