import { describe, expect, it } from 'bun:test'
import type { ProviderHealth } from '@hapipower/protocol'
import { Store } from './index'
import type { StoredProvider } from './providerStore'
import { getDefaultProviderCapabilities } from '../services/providerSecurity'

function defaultHealth(status: ProviderHealth['status'] = 'unknown'): ProviderHealth {
    return {
        status,
        latencyMs: null,
        checkedAt: null,
        errorCode: null,
        errorMessage: null,
        protocolDetected: null,
        capabilities: getDefaultProviderCapabilities(),
    }
}

function createProvider(
    store: Store,
    overrides: Partial<StoredProvider> & Pick<StoredProvider, 'id' | 'namespace' | 'name'>
): StoredProvider {
    const now = Date.now()
    const provider: StoredProvider = {
        id: overrides.id,
        namespace: overrides.namespace,
        name: overrides.name,
        baseUrl: overrides.baseUrl ?? 'https://api.example.com',
        apiKeyEncrypted: overrides.apiKeyEncrypted ?? `encrypted-${overrides.id}`,
        protocol: overrides.protocol ?? 'auto',
        defaultModel: overrides.defaultModel ?? null,
        health: overrides.health ?? defaultHealth(),
        modelCache: overrides.modelCache ?? [],
        modelCacheUpdatedAt: overrides.modelCacheUpdatedAt ?? null,
        notes: overrides.notes ?? '',
        createdAt: overrides.createdAt ?? now,
        updatedAt: overrides.updatedAt ?? now,
    }
    store.providers.create(provider)
    return provider
}

describe('ProviderStore namespace 隔离', () => {
    it('同名 provider 可存在于不同 namespace，读取时按 namespace 过滤', () => {
        const store = new Store(':memory:')
        try {
            const alpha = createProvider(store, { id: '00000000-0000-4000-8000-000000000001', namespace: 'alpha', name: 'Gateway' })
            const beta = createProvider(store, { id: '00000000-0000-4000-8000-000000000002', namespace: 'beta', name: 'Gateway' })

            expect(store.providers.getAll('alpha').map(provider => provider.id)).toEqual([alpha.id])
            expect(store.providers.getAll('beta').map(provider => provider.id)).toEqual([beta.id])
            expect(store.providers.getById(beta.id, 'alpha')).toBeNull()
        } finally {
            store.close()
        }
    })

    it('同一 namespace 内 provider name 必须唯一', () => {
        const store = new Store(':memory:')
        try {
            createProvider(store, { id: '00000000-0000-4000-8000-000000000003', namespace: 'alpha', name: 'Gateway' })

            expect(() => createProvider(store, {
                id: '00000000-0000-4000-8000-000000000004',
                namespace: 'alpha',
                name: 'Gateway',
            })).toThrow()
        } finally {
            store.close()
        }
    })

    it('默认 assignment 只清理同 namespace 同 flavor 的旧默认值', () => {
        const store = new Store(':memory:')
        try {
            const alphaA = createProvider(store, { id: '00000000-0000-4000-8000-000000000005', namespace: 'alpha', name: 'Alpha A' })
            const alphaB = createProvider(store, { id: '00000000-0000-4000-8000-000000000006', namespace: 'alpha', name: 'Alpha B' })
            const beta = createProvider(store, { id: '00000000-0000-4000-8000-000000000007', namespace: 'beta', name: 'Beta A' })

            store.providers.assign(alphaA.id, 'alpha', 'claude', true, 'claude-model-a')
            store.providers.assign(beta.id, 'beta', 'claude', true, 'beta-model')
            store.providers.assign(alphaB.id, 'alpha', 'claude', true, 'claude-model-b')

            expect(store.providers.getDefaultForFlavor('claude', 'alpha')?.id).toBe(alphaB.id)
            expect(store.providers.getDefaultForFlavor('claude', 'beta')?.id).toBe(beta.id)
            expect(store.providers.getAssignments(alphaA.id, 'alpha')[0]?.isDefault).toBe(false)
        } finally {
            store.close()
        }
    })

    it('health 与 model cache 可按 namespace 落库更新', () => {
        const store = new Store(':memory:')
        try {
            const provider = createProvider(store, {
                id: '00000000-0000-4000-8000-000000000008',
                namespace: 'alpha',
                name: 'Health Gateway',
            })
            const health = defaultHealth('online')
            health.latencyMs = 42
            health.checkedAt = 123456
            health.protocolDetected = 'openai'
            health.capabilities.modelsEndpoint = true

            const updated = store.providers.updateHealthAndModelCache(provider.id, 'alpha', health, [
                { id: 'gpt-example', name: 'GPT Example', ownedBy: 'example' },
            ], 987654)

            const stored = store.providers.getById(provider.id, 'alpha')
            expect(updated).toBe(true)
            expect(stored?.health.status).toBe('online')
            expect(stored?.health.latencyMs).toBe(42)
            expect(stored?.modelCache).toEqual([{ id: 'gpt-example', name: 'GPT Example', ownedBy: 'example' }])
            expect(stored?.modelCacheUpdatedAt).toBe(987654)
            expect(store.providers.updateHealthAndModelCache(provider.id, 'beta', health, [], Date.now())).toBe(false)
        } finally {
            store.close()
        }
    })

    it('defaultModel undefined 不清空，显式 null 会清空', () => {
        const store = new Store(':memory:')
        try {
            const provider = createProvider(store, {
                id: '00000000-0000-4000-8000-000000000009',
                namespace: 'alpha',
                name: 'Default Model Gateway',
                defaultModel: 'model-a',
            })

            store.providers.update(provider.id, 'alpha', { name: 'Renamed Gateway' }, Date.now())
            expect(store.providers.getById(provider.id, 'alpha')?.defaultModel).toBe('model-a')

            store.providers.update(provider.id, 'alpha', { defaultModel: null }, Date.now())
            expect(store.providers.getById(provider.id, 'alpha')?.defaultModel).toBeNull()
        } finally {
            store.close()
        }
    })
})
