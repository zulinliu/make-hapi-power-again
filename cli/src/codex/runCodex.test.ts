import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { runCodex } from './runCodex'

const mockCodexSession = vi.hoisted(() => ({
    setPermissionMode: vi.fn(),
    setModel: vi.fn(),
    setModelReasoningEffort: vi.fn(),
    setCollaborationMode: vi.fn(),
    getPermissionMode: vi.fn(),
    getModel: vi.fn(),
    getModelReasoningEffort: vi.fn(),
    getCollaborationMode: vi.fn(),
    stopKeepAlive: vi.fn()
}))

const harness = vi.hoisted(() => ({
    bootstrapArgs: [] as Array<Record<string, unknown>>,
    loopArgs: [] as Array<Record<string, unknown>>,
    session: {
        onUserMessage: vi.fn(),
        onCancelQueuedMessage: vi.fn(),
        updateMetadata: vi.fn(),
        rpcHandlerManager: {
            registerHandler: vi.fn()
        }
    }
}))

vi.mock('@/agent/sessionFactory', () => ({
    bootstrapSession: vi.fn(async (options: Record<string, unknown>) => {
        harness.bootstrapArgs.push(options)
        return {
            api: {},
            session: harness.session
        }
    }),
    bootstrapExistingSession: vi.fn(async (options: Record<string, unknown>) => {
        harness.bootstrapArgs.push(options)
        return {
            api: {},
            session: harness.session
        }
    })
}))

vi.mock('./loop', () => ({
    loop: vi.fn(async (options: Record<string, unknown>) => {
        harness.loopArgs.push(options)
        const onSessionReady = options.onSessionReady as ((session: unknown) => void) | undefined
        onSessionReady?.(mockCodexSession)
    })
}))

vi.mock('@/claude/registerKillSessionHandler', () => ({
    registerKillSessionHandler: vi.fn()
}))

const lifecycleMock = vi.hoisted(() => ({
    registerProcessHandlers: vi.fn(),
    cleanupAndExit: vi.fn(async () => {}),
    markCrash: vi.fn(),
    setExitCode: vi.fn(),
    setArchiveReason: vi.fn(),
    setSessionEndReason: vi.fn()
}))

vi.mock('@/agent/runnerLifecycle', () => ({
    createModeChangeHandler: vi.fn(() => vi.fn()),
    createRunnerLifecycle: vi.fn(() => lifecycleMock),
    setControlledByUser: vi.fn()
}))

vi.mock('@/agent/localHandoff', () => ({
    registerLocalHandoffHandler: vi.fn()
}))

vi.mock('@/ui/logger', () => ({
    logger: {
        debug: vi.fn()
    }
}))

vi.mock('@/utils/attachmentFormatter', () => ({
    formatMessageWithAttachments: vi.fn((text: string) => text)
}))

vi.mock('@/modules/common/slashCommands', () => ({
    listSlashCommands: vi.fn(async () => [])
}))

vi.mock('./utils/slashCommands', () => ({
    resolveCodexSlashCommand: vi.fn(() => ({
        kind: 'passthrough'
    }))
}))

vi.mock('./codexSpecialCommands', () => ({
    parseCodexSpecialCommand: vi.fn(() => ({ type: null }))
}))

vi.mock('./utils/codexCliOverrides', () => ({
    parseCodexCliOverrides: vi.fn(() => ({}))
}))

import { runCodex as runCodexImpl } from './runCodex'
import { parseCodexSpecialCommand } from './codexSpecialCommands'
import { resolveCodexSlashCommand } from './utils/slashCommands'

type QueueProbe = {
    size: () => number
    onBatchConsumed: ((localIds: string[]) => void) | null
    waitForMessagesAndGetAsString: () => Promise<{
        message: string
        isolate: boolean
    } | null>
}

describe('runCodex', () => {
    beforeEach(() => {
        harness.bootstrapArgs.length = 0
        harness.loopArgs.length = 0
        harness.session.onUserMessage.mockReset()
        harness.session.onCancelQueuedMessage.mockReset()
        harness.session.updateMetadata.mockReset()
        harness.session.rpcHandlerManager.registerHandler.mockReset()
        mockCodexSession.setPermissionMode.mockReset()
        mockCodexSession.setModel.mockReset()
        mockCodexSession.setModelReasoningEffort.mockReset()
        mockCodexSession.setCollaborationMode.mockReset()
        mockCodexSession.getPermissionMode.mockReset()
        mockCodexSession.getModel.mockReset()
        mockCodexSession.getModelReasoningEffort.mockReset()
        mockCodexSession.getCollaborationMode.mockReset()
        lifecycleMock.registerProcessHandlers.mockClear()
        lifecycleMock.cleanupAndExit.mockClear()
        lifecycleMock.markCrash.mockClear()
        lifecycleMock.setExitCode.mockClear()
        lifecycleMock.setArchiveReason.mockClear()
        lifecycleMock.setSessionEndReason.mockClear()
        vi.mocked(resolveCodexSlashCommand).mockClear()
        vi.mocked(parseCodexSpecialCommand).mockReset()
        vi.mocked(parseCodexSpecialCommand).mockReturnValue({ type: null })
    })

    it('uses the requested collaboration mode when resuming locally', async () => {
        const options = {
            existingSessionId: 'hapi-power-session-1',
            workingDirectory: '/tmp/project',
            resumeSessionId: 'codex-thread-1',
            collaborationMode: 'plan'
        } as Parameters<typeof runCodex>[0] & { collaborationMode: 'plan' }

        await runCodexImpl(options)

        expect(harness.bootstrapArgs[0]).toEqual(expect.objectContaining({
            sessionId: 'hapi-power-session-1',
            workingDirectory: '/tmp/project',
            metadataOverrides: {
                capabilities: {
                    terminal: true,
                    guideInterrupt: {
                        supported: true,
                        preservesQueue: true,
                        isolatedDelivery: true,
                        version: 1
                    }
                }
            }
        }))
        expect(harness.loopArgs[0]).toEqual(expect.objectContaining({
            resumeSessionId: 'codex-thread-1',
            collaborationMode: 'plan'
        }))
        expect(mockCodexSession.setCollaborationMode).toHaveBeenLastCalledWith('plan')
    })

    it('declares guide capabilities during bootstrap and active socket metadata handshake', async () => {
        await runCodexImpl({
            workingDirectory: '/tmp/project'
        })

        expect(harness.bootstrapArgs[0]).toEqual(expect.objectContaining({
            metadataOverrides: {
                capabilities: {
                    terminal: true,
                    guideInterrupt: {
                        supported: true,
                        preservesQueue: true,
                        isolatedDelivery: true,
                        version: 1
                    }
                }
            }
        }))
        expect(harness.session.updateMetadata).toHaveBeenCalledOnce()

        const updateHandler = harness.session.updateMetadata.mock.calls[0]?.[0] as
            | ((metadata: Record<string, unknown>) => Record<string, unknown>)
            | undefined
        expect(updateHandler).toBeTypeOf('function')
        expect(updateHandler?.({
            name: 'Existing session',
            capabilities: {
                terminal: true
            }
        })).toEqual({
            name: 'Existing session',
            capabilities: {
                terminal: true,
                guideInterrupt: {
                    supported: true,
                    preservesQueue: true,
                    isolatedDelivery: true,
                    version: 1
                }
            }
        })
    })

    it('enqueues guide delivery as an isolated guide batch without slash handling', async () => {
        await runCodexImpl({
            workingDirectory: '/tmp/project'
        })

        const onUserMessage = harness.session.onUserMessage.mock.calls[0]?.[0] as
            | ((message: {
                role: 'user'
                content: { type: 'text'; text: string }
                meta?: { deliveryMode?: 'queue' | 'guide' }
            }, localId?: string, deliveryMode?: 'queue' | 'guide') => void)
            | undefined
        expect(onUserMessage).toBeTypeOf('function')

        const queue = harness.loopArgs[0]?.messageQueue as QueueProbe
        const consumed: string[][] = []
        queue.onBatchConsumed = (localIds) => {
            consumed.push(localIds)
        }

        onUserMessage?.({
            role: 'user',
            content: {
                type: 'text',
                text: '/clear'
            },
            meta: {
                deliveryMode: 'guide'
            }
        }, 'guide-local-1', 'guide')

        await vi.waitFor(() => {
            expect(queue.size()).toBe(1)
        })

        expect(resolveCodexSlashCommand).not.toHaveBeenCalled()

        const batch = await queue.waitForMessagesAndGetAsString()
        expect(batch?.message).toBe('/clear')
        expect(batch?.isolate).toBe(true)
        expect(consumed).toEqual([['guide-local-1']])
    })

    it('uses normal queue handling when guide meta arrives without guide delivery mode', async () => {
        await runCodexImpl({
            workingDirectory: '/tmp/project'
        })

        const onUserMessage = harness.session.onUserMessage.mock.calls[0]?.[0] as
            | ((message: {
                role: 'user'
                content: { type: 'text'; text: string }
                meta?: { deliveryMode?: 'queue' | 'guide' }
            }, localId?: string, deliveryMode?: 'queue' | 'guide') => void)
            | undefined
        expect(onUserMessage).toBeTypeOf('function')

        const queue = harness.loopArgs[0]?.messageQueue as QueueProbe
        onUserMessage?.({
            role: 'user',
            content: {
                type: 'text',
                text: 'queued correction'
            },
            meta: {
                deliveryMode: 'guide'
            }
        }, 'normal-local-1', 'queue')

        await vi.waitFor(() => {
            expect(queue.size()).toBe(1)
        })

        expect(resolveCodexSlashCommand).toHaveBeenCalled()

        const batch = await queue.waitForMessagesAndGetAsString()
        expect(batch?.message).toBe('queued correction')
        expect(batch?.isolate).toBe(false)
    })

    it('runs admin commands first while preserving pending guide and normal queue', async () => {
        await runCodexImpl({
            workingDirectory: '/tmp/project'
        })

        const onUserMessage = harness.session.onUserMessage.mock.calls[0]?.[0] as
            | ((message: {
                role: 'user'
                content: { type: 'text'; text: string }
                meta?: { deliveryMode?: 'queue' | 'guide' }
            }, localId?: string, deliveryMode?: 'queue' | 'guide') => void)
            | undefined
        expect(onUserMessage).toBeTypeOf('function')

        vi.mocked(parseCodexSpecialCommand).mockImplementation((message: string) => (
            message.trim() === '/clear' ? { type: 'clear' } : { type: null }
        ))

        const queue = harness.loopArgs[0]?.messageQueue as QueueProbe
        const consumed: string[][] = []
        queue.onBatchConsumed = (localIds) => {
            consumed.push(localIds)
        }

        onUserMessage?.({
            role: 'user',
            content: {
                type: 'text',
                text: 'normal queued'
            }
        }, 'normal-local-1', 'queue')
        onUserMessage?.({
            role: 'user',
            content: {
                type: 'text',
                text: 'guide correction'
            },
            meta: {
                deliveryMode: 'guide'
            }
        }, 'guide-local-1', 'guide')
        onUserMessage?.({
            role: 'user',
            content: {
                type: 'text',
                text: '/clear'
            }
        }, 'admin-local-1', 'queue')

        await vi.waitFor(() => {
            expect(queue.size()).toBe(3)
        })
        expect(consumed).toEqual([])

        const admin = await queue.waitForMessagesAndGetAsString()
        expect(admin?.message).toBe('/clear')
        expect(admin?.isolate).toBe(true)
        expect(consumed).toEqual([['admin-local-1']])

        const guide = await queue.waitForMessagesAndGetAsString()
        expect(guide?.message).toBe('guide correction')
        expect(guide?.isolate).toBe(true)
        expect(consumed).toEqual([['admin-local-1'], ['guide-local-1']])

        const normal = await queue.waitForMessagesAndGetAsString()
        expect(normal?.message).toBe('normal queued')
        expect(normal?.isolate).toBe(false)
        expect(consumed).toEqual([['admin-local-1'], ['guide-local-1'], ['normal-local-1']])
    })
})
