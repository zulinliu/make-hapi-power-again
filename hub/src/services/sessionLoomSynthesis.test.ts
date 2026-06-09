import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { Session } from '@hapipower/protocol/types'
import type { Store } from '../store'
import type { StoredProvider, StoredProviderAssignment } from '../store/providerStore'
import { encryptAES256GCM } from '../utils/crypto'
import { getDefaultProviderCapabilities } from './providerSecurity'
import {
    SessionLoomSynthesisService,
    type SessionLoomProviderHttpTransport,
} from './sessionLoomSynthesis'

const originalEncryptionKey = process.env.HAPI_POWER_PROVIDER_ENCRYPTION_KEY

afterEach(() => {
    if (originalEncryptionKey === undefined) {
        delete process.env.HAPI_POWER_PROVIDER_ENCRYPTION_KEY
    } else {
        process.env.HAPI_POWER_PROVIDER_ENCRYPTION_KEY = originalEncryptionKey
    }
})

function makeSession(overrides?: Partial<Session>): Session {
    const now = 1_800_000_000_000
    return {
        id: 'session-1',
        namespace: 'default',
        seq: 1,
        createdAt: now,
        updatedAt: now,
        active: true,
        activeAt: now,
        metadata: {
            path: '/home/tester/project',
            host: 'test-host',
            name: 'Example Session',
            flavor: 'codex',
        },
        metadataVersion: 1,
        agentState: null,
        agentStateVersion: 1,
        thinking: false,
        thinkingAt: now,
        model: 'session-model',
        modelReasoningEffort: null,
        effort: null,
        ...overrides,
    }
}

function makeProvider(apiKeyEncrypted: string): StoredProvider {
    return {
        id: 'provider-1',
        namespace: 'default',
        name: 'Test Provider',
        baseUrl: 'https://api.example.com/v1',
        apiKeyEncrypted,
        protocol: 'openai',
        defaultModel: 'provider-model',
        health: {
            status: 'unknown',
            latencyMs: null,
            checkedAt: null,
            errorCode: null,
            errorMessage: null,
            protocolDetected: null,
            capabilities: getDefaultProviderCapabilities(),
        },
        modelCache: [{ id: 'cached-model', name: 'Cached Model' }],
        modelCacheUpdatedAt: null,
        notes: '',
        createdAt: 1,
        updatedAt: 1,
    }
}

function makeStore(provider: StoredProvider, assignment: StoredProviderAssignment): Store {
    return {
        providers: {
            getDefaultForFlavor: (agentFlavor: string, namespace: string) =>
                agentFlavor === assignment.agentFlavor && namespace === assignment.namespace ? provider : null,
            getAssignmentsForFlavor: (agentFlavor: string, namespace: string) =>
                agentFlavor === assignment.agentFlavor && namespace === assignment.namespace ? [assignment] : [],
        }
    } as unknown as Store
}

describe('SessionLoomSynthesisService', () => {
    it('calls the current session provider model in the background and extracts Markdown', async () => {
        process.env.HAPI_POWER_PROVIDER_ENCRYPTION_KEY = '00'.repeat(32)
        const encryptedKey = encryptAES256GCM('test-api-key', Buffer.from('00'.repeat(32), 'hex'))
        const provider = makeProvider(encryptedKey)
        const assignment: StoredProviderAssignment = {
            id: 1,
            namespace: 'default',
            providerId: provider.id,
            agentFlavor: 'codex',
            isDefault: true,
            model: 'assignment-model',
        }
        const captured: Array<{
            url: string
            headers: Record<string, string>
            body: string
        }> = []
        const transport = mock<SessionLoomProviderHttpTransport>(async (url, options) => {
            captured.push({
                url: url.toString(),
                headers: options.headers,
                body: options.body,
            })
            return {
                status: 200,
                headers: { get: () => null },
                readText: async () => JSON.stringify({
                    choices: [
                        {
                            message: {
                                content: '```markdown\n# Design Plan\n\n## Final Solution\n\nUse provider API.\n```',
                            },
                        },
                    ],
                }),
            }
        })
        const service = new SessionLoomSynthesisService({
            transport,
            security: {
                resolveHost: async () => ['93.184.216.34'],
            },
        })

        const result = await service.synthesizeDesign({
            store: makeStore(provider, assignment),
            session: makeSession(),
            systemPrompt: 'Return Markdown.',
            prompt: 'Full session material',
        })

        expect(result.markdown).toBe('# Design Plan\n\n## Final Solution\n\nUse provider API.')
        expect(result.provider).toEqual({
            providerId: 'provider-1',
            providerName: 'Test Provider',
            protocol: 'openai',
            model: 'session-model',
            agentFlavor: 'codex',
        })
        const call = captured[0]
        if (!call) throw new Error('Expected provider transport call')
        expect(call.url).toBe('https://api.example.com/v1/chat/completions')
        expect(call.headers.authorization).toBe('Bearer test-api-key')
        const body = JSON.parse(call.body) as { model?: string; messages?: Array<{ role: string; content: string }> }
        expect(body.model).toBe('session-model')
        expect(body.messages?.[0]).toEqual({ role: 'system', content: 'Return Markdown.' })
        expect(body.messages?.[1]).toEqual({ role: 'user', content: 'Full session material' })
        expect(transport).toHaveBeenCalledTimes(1)
    })
})
