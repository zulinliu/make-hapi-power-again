import type { RawJSONLines } from '@/claude/types'
import { isClaudeChatVisibleMessage as isSharedClaudeChatVisibleMessage } from '@hapipower/protocol/messages'

export function isClaudeChatVisibleMessage(message: Pick<RawJSONLines, 'type'> & { subtype?: string }): boolean {
    return isSharedClaudeChatVisibleMessage(message)
}
