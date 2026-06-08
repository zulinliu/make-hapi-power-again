import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import type { ApiClient } from '@/api/client'
import { I18nProvider } from '@/lib/i18n-context'
import {
    ConversationOutlinePanel,
    captureScrollAnchor,
    getScrollIntent,
    locateOutlineTargetMessage,
    restoreFocusAfterPanelClose,
    restoreScrollAnchor,
    shouldCancelInitialScrollSettling,
} from '@/components/AssistantChat/HappyThread'
import type { ConversationOutlineItem } from '@/chat/outline'
import type {
    SessionLoomExportListResponse,
    SessionLoomExportPreviewRequest,
    SessionLoomExportPreviewResponse,
    SessionLoomOutlineResponse,
} from '@/types/api'

const originalNavigatorShare = (navigator as Navigator & { share?: unknown }).share
const originalNavigatorClipboard = navigator.clipboard

function setNavigatorProperty(name: 'share' | 'clipboard', value: unknown): void {
    Object.defineProperty(navigator, name, {
        configurable: true,
        value
    })
}

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
    setNavigatorProperty('share', originalNavigatorShare)
    setNavigatorProperty('clipboard', originalNavigatorClipboard)
})

const outlineItems: ConversationOutlineItem[] = [
    {
        id: 'outline:user-text:m1',
        targetMessageId: 'user-text:m1',
        kind: 'user',
        label: 'Implement the panel',
        createdAt: 1000
    },
    {
        id: 'outline:user-text:m2',
        targetMessageId: 'user-text:m2',
        kind: 'user',
        label: 'Second user prompt',
        createdAt: 2000
    }
]

function rect(values: Pick<DOMRect, 'top' | 'bottom'> & Partial<DOMRect>): DOMRect {
    return {
        left: 0,
        right: 300,
        width: 300,
        height: values.bottom - values.top,
        x: 0,
        y: values.top,
        toJSON: () => ({}),
        ...values
    } as DOMRect
}

function renderPanel(props: Partial<ComponentProps<typeof ConversationOutlinePanel>> = {}) {
    return render(
        <I18nProvider>
            <ConversationOutlinePanel
                title="project"
                items={outlineItems}
                hasMoreMessages={false}
                isLoadingMoreMessages={false}
                onLoadMore={vi.fn()}
                onSelect={vi.fn()}
                onClose={vi.fn()}
                {...props}
            />
        </I18nProvider>
    )
}

function createSessionLoomApi(overrides: Partial<Pick<
    ApiClient,
    | 'getSessionLoomOutline'
    | 'listSessionLoomExports'
    | 'previewSessionLoomExport'
    | 'createSessionLoomExport'
    | 'downloadSessionLoomExport'
    | 'deleteSessionLoomExport'
>> = {}): ApiClient {
    const outline: SessionLoomOutlineResponse = {
        success: true,
        sessionId: 'session-1',
        title: 'project',
        generatedAt: 3000,
        items: [
            {
                id: 'session-loom:decision:m3',
                targetMessageId: 'agent:m3',
                kind: 'decision',
                label: 'Decision: keep the server outline',
                createdAt: 3000,
                depth: 1
            }
        ],
        stats: {
            totalMessages: 3,
            outlineItems: 1,
            firstMessageAt: 1000,
            lastMessageAt: 3000
        }
    }
    const assets: SessionLoomExportListResponse = {
        success: true,
        assets: []
    }
    const preview: SessionLoomExportPreviewResponse = {
        success: true,
        sessionId: 'session-1',
        generatedAt: 4000,
        markdown: '# Session Loom',
        title: 'project',
        stats: {
            messageCount: 2,
            outlineCount: 1,
            userMessages: 1,
            assistantMessages: 1,
            systemEvents: 0,
            redactions: 1,
            filteredToolDetails: 0
        },
        filters: {
            redactSecrets: true,
            includeSystemEvents: false,
            includeToolDetails: false
        },
        warnings: []
    }

    return {
        getSessionLoomOutline: vi.fn(async () => outline),
        listSessionLoomExports: vi.fn(async () => assets),
        previewSessionLoomExport: vi.fn(async () => preview),
        createSessionLoomExport: vi.fn(async () => ({
            success: true,
            asset: {
                exportId: 'export-1',
                sessionId: 'session-1',
                title: 'project',
                fileName: 'project.md',
                format: 'markdown',
                template: 'raw',
                createdAt: 4000,
                expiresAt: 4000 + 7 * 24 * 60 * 60 * 1000,
                sizeBytes: 14,
                checksum: '0123456789abcdef',
                stats: preview.stats
            },
            markdown: preview.markdown
        })),
        downloadSessionLoomExport: vi.fn(async () => preview.markdown),
        deleteSessionLoomExport: vi.fn(async () => undefined),
        ...overrides
    } as unknown as ApiClient
}

describe('ConversationOutlinePanel', () => {
    it('renders outline items and selects an item', () => {
        const onSelect = vi.fn()
        renderPanel({ onSelect })

        expect(screen.getByRole('complementary', { name: 'Session Loom' })).toBeInTheDocument()
        fireEvent.click(screen.getByText('Implement the panel'))

        expect(onSelect).toHaveBeenCalledWith(outlineItems[0])
    })

    it('renders Session Loom tabs', () => {
        renderPanel()

        expect(screen.getByRole('tab', { name: 'Outline' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Export' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Synthesis' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Assets' })).toBeInTheDocument()
    })

    it('links Session Loom tabs to their active panel', () => {
        renderPanel()

        expect(screen.getByRole('tab', { name: 'Outline' })).toHaveAttribute('aria-controls', 'session-loom-panel-outline')
        expect(screen.getByRole('tabpanel', { name: 'Outline' })).toHaveAttribute('id', 'session-loom-panel-outline')

        fireEvent.click(screen.getByRole('tab', { name: 'Export' }))

        expect(screen.getByRole('tab', { name: 'Export' })).toHaveAttribute('aria-controls', 'session-loom-panel-export')
        expect(screen.getByRole('tabpanel', { name: 'Export' })).toHaveAttribute('id', 'session-loom-panel-export')
    })

    it('shows load earlier when older messages exist', () => {
        const onLoadMore = vi.fn()
        renderPanel({ hasMoreMessages: true, onLoadMore })

        fireEvent.click(screen.getByRole('button', { name: /Load earlier/ }))

        expect(onLoadMore).toHaveBeenCalledTimes(1)
    })

    it('renders an empty state', () => {
        renderPanel({ items: [] })

        expect(screen.getByText('No outline items in this session yet.')).toBeInTheDocument()
    })

    it('keeps outline item touch targets at least 44px tall', () => {
        renderPanel()

        expect(screen.getByText('Implement the panel').closest('button')).toHaveClass('min-h-11')
    })

    it('prefers the server outline when Session Loom API is available', async () => {
        const onSelect = vi.fn()
        const api = createSessionLoomApi()

        renderPanel({
            api,
            sessionId: 'session-1',
            onSelect
        })

        fireEvent.click(await screen.findByText('Decision: keep the server outline'))

        expect(api.getSessionLoomOutline).toHaveBeenCalledWith('session-1')
        expect(onSelect).toHaveBeenCalledWith({
            id: 'session-loom:decision:m3',
            targetMessageId: 'agent:m3',
            kind: 'user',
            label: 'Decision: keep the server outline',
            createdAt: 3000
        })
    })

    it('gives the export template selector an accessible name', () => {
        renderPanel()

        fireEvent.click(screen.getByRole('tab', { name: 'Export' }))

        expect(screen.getByRole('combobox', { name: 'Export template' })).toBeInTheDocument()
    })

    it('requests export previews with redaction enabled by default', async () => {
        const previewSessionLoomExport = vi.fn(async () => ({
            success: true,
            sessionId: 'session-1',
            generatedAt: 4000,
            markdown: '# Export',
            title: 'project',
            stats: {
                messageCount: 2,
                outlineCount: 1,
                userMessages: 1,
                assistantMessages: 1,
                systemEvents: 0,
                redactions: 1,
                filteredToolDetails: 0
            },
            filters: {
                redactSecrets: true,
                includeSystemEvents: false,
                includeToolDetails: false
            },
            warnings: []
        } satisfies SessionLoomExportPreviewResponse))
        const api = createSessionLoomApi({ previewSessionLoomExport })

        renderPanel({
            api,
            sessionId: 'session-1'
        })

        fireEvent.click(screen.getByRole('tab', { name: 'Export' }))
        fireEvent.click(screen.getByRole('button', { name: 'Preview export' }))

        await waitFor(() => {
            expect(previewSessionLoomExport).toHaveBeenCalledWith(
                'session-1',
                expect.objectContaining({
                    language: 'en',
                    format: 'markdown',
                    template: 'raw',
                    filters: {
                        redactSecrets: true,
                        includeSystemEvents: false,
                        includeToolDetails: false
                    }
                } satisfies Partial<SessionLoomExportPreviewRequest>)
            )
        })
        expect(await screen.findByText('Export preview is ready.')).toBeInTheDocument()
    })

    it('copies Markdown when Web Share rejects', async () => {
        const share = vi.fn(async () => {
            throw new Error('share unavailable')
        })
        const writeText = vi.fn(async () => undefined)
        setNavigatorProperty('share', share)
        setNavigatorProperty('clipboard', { writeText })
        const api = createSessionLoomApi({
            previewSessionLoomExport: vi.fn(async () => ({
                success: true,
                sessionId: 'session-1',
                generatedAt: 4000,
                markdown: '# Export fallback',
                title: 'project',
                stats: {
                    messageCount: 2,
                    outlineCount: 1,
                    userMessages: 1,
                    assistantMessages: 1,
                    systemEvents: 0,
                    redactions: 1,
                    filteredToolDetails: 0
                },
                filters: {
                    redactSecrets: true,
                    includeSystemEvents: false,
                    includeToolDetails: false
                },
                warnings: []
            } satisfies SessionLoomExportPreviewResponse))
        })

        renderPanel({
            api,
            sessionId: 'session-1'
        })

        fireEvent.click(screen.getByRole('tab', { name: 'Export' }))
        fireEvent.click(screen.getByRole('button', { name: 'Preview export' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Share' }))

        await waitFor(() => {
            expect(share).toHaveBeenCalledWith({ title: 'project', text: '# Export fallback' })
            expect(writeText).toHaveBeenCalledWith('# Export fallback')
        })
        expect(await screen.findByText('Share was unavailable, so the Markdown was copied.')).toBeInTheDocument()
    })

    it('deletes exported assets from the asset list', async () => {
        const deleteSessionLoomExport = vi.fn(async () => undefined)
        const api = createSessionLoomApi({
            listSessionLoomExports: vi.fn(async () => ({
                success: true,
                assets: [
                    {
                        exportId: 'export-1',
                        sessionId: 'session-1',
                        title: 'project',
                        fileName: 'project.md',
                        format: 'markdown',
                        template: 'raw',
                        createdAt: 4000,
                        expiresAt: 4000 + 7 * 24 * 60 * 60 * 1000,
                        sizeBytes: 14,
                        checksum: '0123456789abcdef',
                        stats: {
                            messageCount: 2,
                            outlineCount: 1,
                            userMessages: 1,
                            assistantMessages: 1,
                            systemEvents: 0,
                            redactions: 1,
                            filteredToolDetails: 0
                        }
                    }
                ]
            } satisfies SessionLoomExportListResponse)),
            deleteSessionLoomExport
        })

        renderPanel({
            api,
            sessionId: 'session-1'
        })

        fireEvent.click(screen.getByRole('tab', { name: 'Assets' }))
        expect(await screen.findByText('project.md')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Delete asset' }))

        await waitFor(() => {
            expect(deleteSessionLoomExport).toHaveBeenCalledWith('session-1', 'export-1')
            expect(screen.queryByText('project.md')).not.toBeInTheDocument()
        })
        expect(await screen.findByText('Export asset deleted.')).toBeInTheDocument()
    })
})

describe('scroll anchor helpers', () => {
    it('captures the first visible message relative to the viewport', () => {
        const viewport = document.createElement('div')
        const first = document.createElement('div')
        const second = document.createElement('div')
        first.id = 'first-message'
        second.id = 'second-message'
        viewport.className = 'viewport'
        const messages = document.createElement('div')
        messages.className = 'happy-thread-messages'
        messages.append(first, second)
        viewport.append(messages)
        document.body.append(viewport)

        vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(rect({ top: 100, bottom: 500 }))
        vi.spyOn(first, 'getBoundingClientRect').mockReturnValue(rect({ top: 60, bottom: 90 }))
        vi.spyOn(second, 'getBoundingClientRect').mockReturnValue(rect({ top: 120, bottom: 180 }))

        expect(captureScrollAnchor(viewport)).toEqual({
            id: 'second-message',
            topOffset: 20
        })

        viewport.remove()
    })

    it('treats upward motion near the bottom as manual scroll intent', () => {
        expect(getScrollIntent({
            scrollTop: 690,
            previousScrollTop: 702,
            scrollHeight: 1232,
            clientHeight: 530
        })).toMatchObject({
            distanceFromBottom: 12,
            isNearBottom: true,
            isScrollingUp: true
        })
    })

    it('does not classify downward movement as upward manual scroll intent', () => {
        expect(getScrollIntent({
            scrollTop: 702,
            previousScrollTop: 690,
            scrollHeight: 1232,
            clientHeight: 530
        })).toMatchObject({
            distanceFromBottom: 0,
            isNearBottom: true,
            isScrollingUp: false
        })
    })

    it('cancels initial scroll settling when the user scrolls up away from the bottom', () => {
        const intent = getScrollIntent({
            scrollTop: 520,
            previousScrollTop: 700,
            scrollHeight: 1232,
            clientHeight: 530
        })

        expect(intent).toMatchObject({
            distanceFromBottom: 182,
            isScrollingUp: true
        })
        expect(shouldCancelInitialScrollSettling(intent)).toBe(true)
    })

    it('keeps initial scroll settling for negligible movement at the bottom', () => {
        const intent = getScrollIntent({
            scrollTop: 702,
            previousScrollTop: 702,
            scrollHeight: 1232,
            clientHeight: 530
        })

        expect(intent).toMatchObject({
            distanceFromBottom: 0,
            isScrollingUp: false
        })
        expect(shouldCancelInitialScrollSettling(intent)).toBe(false)
    })

    it('restores the captured message to the same viewport offset', () => {
        const viewport = document.createElement('div')
        const message = document.createElement('div')
        message.id = 'anchored-message'
        viewport.append(message)
        document.body.append(viewport)
        viewport.scrollTop = 200

        vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(rect({ top: 100, bottom: 500 }))
        vi.spyOn(message, 'getBoundingClientRect').mockReturnValue(rect({ top: 180, bottom: 260 }))

        expect(restoreScrollAnchor(viewport, { id: 'anchored-message', topOffset: 30 })).toBe(true)
        expect(viewport.scrollTop).toBe(250)

        viewport.remove()
    })

    it('restores focus to the trigger after the panel closes', () => {
        vi.useFakeTimers()
        const trigger = document.createElement('button')
        const other = document.createElement('button')
        document.body.append(trigger, other)
        other.focus()

        restoreFocusAfterPanelClose(trigger)
        vi.runAllTimers()

        expect(document.activeElement).toBe(trigger)
        trigger.remove()
        other.remove()
    })
})

describe('outline target loading', () => {
    it('loads older messages through the scroll-preserving wrapper until the target appears', async () => {
        const loadOlderPreservingScroll = vi.fn<() => Promise<boolean>>()
        let loadCount = 0
        loadOlderPreservingScroll.mockImplementation(async () => {
            loadCount += 1
            return true
        })

        const findTarget = vi.fn((anchorId: string) => {
            if (anchorId !== 'hapi-power-message-user-text:target') {
                return null
            }
            return loadCount >= 2 ? document.createElement('div') : null
        })

        const target = await locateOutlineTargetMessage({
            targetMessageId: 'user-text:target',
            findTarget,
            hasMoreMessages: () => loadCount < 2,
            loadOlderPreservingScroll
        })

        expect(target).toBeInstanceOf(HTMLElement)
        expect(loadOlderPreservingScroll).toHaveBeenCalledTimes(2)
        expect(findTarget).toHaveBeenCalledWith('hapi-power-message-user-text:target')
    })

    it('stops when history is exhausted before the target is loaded', async () => {
        const loadOlderPreservingScroll = vi.fn(async () => false)

        const target = await locateOutlineTargetMessage({
            targetMessageId: 'user-text:missing',
            findTarget: () => null,
            hasMoreMessages: () => true,
            loadOlderPreservingScroll
        })

        expect(target).toBeNull()
        expect(loadOlderPreservingScroll).toHaveBeenCalledTimes(1)
    })
})
