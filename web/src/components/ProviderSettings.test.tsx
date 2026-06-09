import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type ApiClient } from '@/api/client'
import { AppContextProvider } from '@/lib/app-context'
import { I18nProvider } from '@/lib/i18n-context'
import type { ProviderWithAssignments, RevealProviderKeyResponse } from '@hapipower/protocol'
import { ProviderSettings } from './ProviderSettings'

type ProviderApiMock = Pick<
    ApiClient,
    | 'getProviderOverview'
    | 'createProvider'
    | 'updateProvider'
    | 'deleteProvider'
    | 'assignProvider'
    | 'unassignProvider'
    | 'checkProvider'
    | 'discoverModels'
    | 'revealProviderKey'
>

function providerFixture(overrides: Partial<ProviderWithAssignments> = {}): ProviderWithAssignments {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        namespace: 'default',
        name: 'GLM Bridge',
        baseUrl: 'https://api.example.com/v1',
        apiKeyMasked: '••••abcd',
        protocol: 'openai',
        defaultModel: 'glm-5.1',
        health: {
            status: 'online',
            latencyMs: 128,
            checkedAt: 1765200000000,
            errorCode: null,
            errorMessage: null,
            protocolDetected: 'openai',
            capabilities: {
                modelsEndpoint: true,
                messagesEndpoint: true,
                streaming: true,
                tokenUsage: true,
                contextWindow: 128000,
                toolUse: true,
                imageInput: false,
            },
        },
        modelCache: [
            { id: 'glm-5.1', name: 'glm-5.1', ownedBy: 'example' },
            { id: 'glm-5.1-air', name: 'glm-5.1-air', ownedBy: 'example' },
        ],
        modelCacheUpdatedAt: 1765200000000,
        notes: 'default route',
        createdAt: 1765200000000,
        updatedAt: 1765200000000,
        assignments: [
            {
                namespace: 'default',
                providerId: '11111111-1111-4111-8111-111111111111',
                agentFlavor: 'codex',
                isDefault: true,
                model: 'glm-5.1',
            },
        ],
        ...overrides,
    }
}

function createApiMock(provider: ProviderWithAssignments = providerFixture()): ProviderApiMock {
    return {
        getProviderOverview: vi.fn(async () => ({
            providers: [provider],
            summary: {
                total: 1,
                online: 1,
                degraded: 0,
                offline: 0,
                blocked: 0,
                unknown: 0,
                assignedAgents: 1,
            },
        })),
        createProvider: vi.fn(async () => ({ provider })),
        updateProvider: vi.fn(async () => ({ provider })),
        deleteProvider: vi.fn(async () => undefined),
        assignProvider: vi.fn(async () => undefined),
        unassignProvider: vi.fn(async () => undefined),
        checkProvider: vi.fn(async () => ({
            success: true,
            provider,
            diagnostic: {
                hostLabel: 'api.example.com',
                path: '/v1/models',
                statusCode: 200,
                latencyMs: 128,
                errorCode: null,
                safeMessage: null,
                capabilities: provider.health.capabilities,
            },
        })),
        discoverModels: vi.fn(async () => ({
            success: true,
            models: provider.modelCache,
            health: provider.health,
        })),
        revealProviderKey: vi.fn(async (): Promise<RevealProviderKeyResponse> => ({
            apiKey: 'sk-test-revealed',
        })),
    }
}

function renderProviderSettings(api: ProviderApiMock = createApiMock()) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })

    const result = render(
        <QueryClientProvider client={queryClient}>
            <I18nProvider>
                <AppContextProvider value={{ api: api as unknown as ApiClient, token: 'test-token', baseUrl: '' }}>
                    <ProviderSettings />
                </AppContextProvider>
            </I18nProvider>
        </QueryClientProvider>
    )

    return { ...result, api, queryClient }
}

describe('ProviderSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers({ shouldAdvanceTime: true })
        const localStorageMock = {
            getItem: vi.fn(() => 'en'),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
            key: vi.fn(() => null),
            length: 0,
        }
        Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true })
    })

    afterEach(() => {
        vi.useRealTimers()
        cleanup()
    })

    it('renders the Model Nexus control plane with summary, health, and route matrix', async () => {
        renderProviderSettings()

        expect(await screen.findByText('Model Nexus')).toBeInTheDocument()
        expect(screen.getByText(/Connect providers, check health/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Add to Model Nexus' })).toBeInTheDocument()
        expect(screen.getByText('Providers')).toBeInTheDocument()
        expect(screen.getByText('Blocked')).toBeInTheDocument()
        expect(screen.getByText('Unknown')).toBeInTheDocument()
        expect(screen.getByText('Assigned')).toBeInTheDocument()
        expect(screen.getByText('GLM Bridge')).toBeInTheDocument()
        expect(screen.getByText('api.example.com')).toBeInTheDocument()
        expect(screen.queryByText('https://api.example.com/v1')).not.toBeInTheDocument()
        expect(screen.getByText('Usage metrics')).toBeInTheDocument()
        expect(screen.getByText('128K context')).toBeInTheDocument()
        expect(screen.getByText('Tools')).toBeInTheDocument()
        expect(screen.getAllByText('Online').length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText('128 ms')).toBeInTheDocument()
        expect(screen.getByText('glm-5.1')).toBeInTheDocument()
        expect(screen.getByText('Agent route matrix')).toBeInTheDocument()
        expect(screen.getByLabelText('Codex')).toHaveValue('11111111-1111-4111-8111-111111111111')
    })

    it('assigns and unassigns providers from the agent route matrix', async () => {
        const api = createApiMock()
        renderProviderSettings(api)

        const claudeRoute = await screen.findByLabelText('Claude')
        fireEvent.change(claudeRoute, { target: { value: '11111111-1111-4111-8111-111111111111' } })

        await waitFor(() => {
            expect(api.assignProvider).toHaveBeenCalledWith(
                '11111111-1111-4111-8111-111111111111',
                'claude',
                true,
                'glm-5.1'
            )
        })

        fireEvent.change(screen.getByLabelText('Codex'), { target: { value: '' } })

        await waitFor(() => {
            expect(api.unassignProvider).toHaveBeenCalledWith(
                '11111111-1111-4111-8111-111111111111',
                'codex'
            )
        })
    })

    it('requires explicit reveal before showing a provider key and copies with the textarea fallback', async () => {
        const api = createApiMock()
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: vi.fn(async () => { throw new Error('clipboard unavailable') }) },
            configurable: true,
        })
        const execCommand = vi.fn(() => true)
        Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })

        renderProviderSettings(api)

        fireEvent.click(await screen.findByRole('button', { name: 'Reveal key' }))
        expect(screen.getByText('Reveal provider key')).toBeInTheDocument()
        expect(screen.queryByText('sk-test-revealed')).not.toBeInTheDocument()

        fireEvent.click(screen.getAllByRole('button', { name: 'Reveal key' }).at(-1)!)

        expect(await screen.findByText('sk-test-revealed')).toBeInTheDocument()
        expect(api.revealProviderKey).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111')

        fireEvent.click(screen.getByRole('button', { name: 'Copy' }))

        await waitFor(() => {
            expect(execCommand).toHaveBeenCalledWith('copy')
            expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
        })
    })

    it('uses a four-step wizard with labelled 44px connection inputs', async () => {
        renderProviderSettings()

        fireEvent.click(await screen.findByRole('button', { name: 'Add to Model Nexus' }))

        expect(screen.getByText('Add provider to Model Nexus')).toBeInTheDocument()
        expect(screen.getByText(/Provider URLs are validated/)).toBeInTheDocument()
        expect(screen.getAllByText('Protocol').length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText('Connection')).toBeInTheDocument()
        expect(screen.getByText('Capability')).toBeInTheDocument()
        expect(screen.getByText('Assignment')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        const nameInput = screen.getByLabelText('Name')
        const baseUrlInput = screen.getByLabelText('Base URL')
        const apiKeyInput = screen.getByLabelText('API Key')

        expect(nameInput).toHaveClass('min-h-[44px]')
        expect(baseUrlInput).toHaveClass('min-h-[44px]')
        expect(apiKeyInput).toHaveClass('min-h-[44px]')
        expect(apiKeyInput).toHaveClass('text-base')
    })

    it('creates a provider through the wizard and assigns selected agents', async () => {
        const api = createApiMock()
        renderProviderSettings(api)

        fireEvent.click(await screen.findByRole('button', { name: 'Add to Model Nexus' }))
        fireEvent.click(screen.getByRole('radio', { name: 'OpenAI' }))
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Bridge' } })
        fireEvent.change(screen.getByLabelText('Base URL'), { target: { value: 'https://model.example.com/v1' } })
        fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-test-new' } })
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        fireEvent.change(screen.getByLabelText('Default model'), { target: { value: 'glm-5.1' } })
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        fireEvent.click(screen.getByRole('checkbox', { name: 'Claude' }))
        fireEvent.click(screen.getByRole('button', { name: 'Save provider' }))

        await waitFor(() => {
            expect(api.createProvider).toHaveBeenCalledWith({
                name: 'New Bridge',
                baseUrl: 'https://model.example.com/v1',
                apiKey: 'sk-test-new',
                protocol: 'openai',
                defaultModel: 'glm-5.1',
                notes: undefined,
            })
            expect(api.assignProvider).toHaveBeenCalledWith(
                '11111111-1111-4111-8111-111111111111',
                'claude',
                true,
                'glm-5.1'
            )
        })
    })

    it('keeps the wizard open and shows SSRF validation errors when provider save is blocked', async () => {
        const api = createApiMock()
        vi.mocked(api.createProvider).mockRejectedValueOnce(new ApiError(
            'HTTP 400 Bad Request: Provider host resolves to a private or metadata address.',
            400,
            'dns-private-ip-blocked',
            '{"error":"Provider host resolves to a private or metadata address.","code":"dns-private-ip-blocked"}'
        ))
        renderProviderSettings(api)

        fireEvent.click(await screen.findByRole('button', { name: 'Add to Model Nexus' }))
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Internal Bridge' } })
        fireEvent.change(screen.getByLabelText('Base URL'), { target: { value: 'https://private.example.com/v1' } })
        fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-test-private' } })
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        fireEvent.click(screen.getByRole('checkbox', { name: 'Claude' }))
        fireEvent.click(screen.getByRole('button', { name: 'Save provider' }))

        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent('Provider was not saved')
        expect(alert).toHaveTextContent('private or metadata address')
        expect(screen.getByText('Add provider to Model Nexus')).toBeInTheDocument()
        expect(api.assignProvider).not.toHaveBeenCalled()
    })
})
