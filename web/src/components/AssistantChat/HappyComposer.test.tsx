import { cleanup, render, screen } from '@testing-library/react'
import type { ButtonHTMLAttributes, FormEventHandler, MutableRefObject, ReactNode, TextareaHTMLAttributes } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n-context'
import type { MessageDeliveryMode } from '@/types/api'
import { HappyComposer } from './HappyComposer'

const mockAssistantRuntime = vi.hoisted(() => {
    const setText = vi.fn()
    const addAttachment = vi.fn()
    const send = vi.fn()
    const cancelRun = vi.fn()
    return {
        state: {
            composer: {
                text: 'guide me',
                attachments: [] as Array<{ status: { type: string } }>
            },
            thread: {
                isRunning: true,
                isDisabled: false
            }
        },
        setText,
        addAttachment,
        send,
        cancelRun
    }
})

vi.mock('@assistant-ui/react', async () => {
    const React = await import('react')

    const Root = (props: {
        children?: ReactNode
        className?: string
        onSubmit?: FormEventHandler<HTMLFormElement>
    }) => React.createElement('form', {
        className: props.className,
        onSubmit: props.onSubmit
    }, props.children)

    const Input = React.forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & {
        cancelOnEscape?: boolean
        maxRows?: number
        submitOnEnter?: boolean
    }>((props, ref) => {
        const {
            cancelOnEscape: _cancelOnEscape,
            maxRows: _maxRows,
            submitOnEnter: _submitOnEnter,
            ...rest
        } = props
        return React.createElement('textarea', {
            ...rest,
            ref,
            value: mockAssistantRuntime.state.composer.text,
            readOnly: true
        })
    })
    Input.displayName = 'MockComposerInput'

    const AddAttachment = (props: ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) => (
        React.createElement('button', {
            ...props,
            type: 'button'
        }, props.children)
    )

    return {
        ComposerPrimitive: {
            Root,
            Input,
            AddAttachment,
            Attachments: () => null
        },
        AttachmentPrimitive: {
            Root: (props: { children?: ReactNode; className?: string }) => React.createElement('div', props, props.children),
            Remove: (props: ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) => (
                React.createElement('button', { ...props, type: 'button' }, props.children)
            )
        },
        useAssistantApi: () => ({
            composer: () => ({
                setText: mockAssistantRuntime.setText,
                addAttachment: mockAssistantRuntime.addAttachment,
                send: mockAssistantRuntime.send
            }),
            thread: () => ({
                cancelRun: mockAssistantRuntime.cancelRun
            })
        }),
        useAssistantState: <T,>(selector: (state: typeof mockAssistantRuntime.state) => T): T => selector(mockAssistantRuntime.state),
        useThreadComposerAttachment: () => ({
            name: 'attachment.txt',
            status: { type: 'complete' }
        })
    }
})

vi.mock('@/hooks/useComposerDraft', () => ({
    useComposerDraft: vi.fn()
}))

vi.mock('@/hooks/usePlatform', () => ({
    usePlatform: () => ({
        isTelegram: false,
        isTouch: false,
        haptic: {
            impact: vi.fn(),
            notification: vi.fn(),
            selection: vi.fn()
        }
    })
}))

vi.mock('@/hooks/usePWAInstall', () => ({
    usePWAInstall: () => ({
        installState: 'idle',
        canInstall: false,
        canInstallIOS: false,
        isStandalone: false,
        isIOS: false,
        promptInstall: vi.fn(),
        dismissInstall: vi.fn(),
        dismissLater: vi.fn()
    })
}))

function renderComposer(options: {
    deliveryModeRef?: MutableRefObject<MessageDeliveryMode>
    guideInterruptSupported?: boolean
} = {}) {
    return render(
        <I18nProvider>
            <HappyComposer
                sessionId="session-A"
                active={true}
                thinking={true}
                agentState={null}
                agentFlavor="codex"
                deliveryModeRef={options.deliveryModeRef}
                guideInterruptSupported={options.guideInterruptSupported ?? false}
            />
        </I18nProvider>
    )
}

describe('HappyComposer Guide delivery mode', () => {
    beforeEach(() => {
        localStorage.clear()
        mockAssistantRuntime.state.composer.text = 'guide me'
        mockAssistantRuntime.state.composer.attachments = []
        vi.clearAllMocks()
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            callback(0)
            return 1
        })
        vi.stubGlobal('cancelAnimationFrame', vi.fn())
    })

    afterEach(() => {
        cleanup()
        vi.unstubAllGlobals()
    })

    it('defaults follow-up behavior to queue without rendering composer-level controls', () => {
        const deliveryModeRef: MutableRefObject<MessageDeliveryMode> = { current: 'guide' }

        renderComposer({ deliveryModeRef })

        expect(screen.queryByText('Follow-up behavior: queue')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Use guide' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Send guide now' })).not.toBeInTheDocument()
        expect(deliveryModeRef.current).toBe('queue')
    })

    it('uses guide delivery when the stored follow-up behavior is guide and the session supports guide interrupt', () => {
        const deliveryModeRef: MutableRefObject<MessageDeliveryMode> = { current: 'queue' }
        localStorage.setItem('hapi-power-follow-up-behavior', 'guide')

        renderComposer({ deliveryModeRef, guideInterruptSupported: true })

        expect(screen.queryByText('Follow-up behavior: guide')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Use queue' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Send guide now' })).toBeInTheDocument()
        expect(deliveryModeRef.current).toBe('guide')
    })

    it('falls back to queue when guide is preferred but the session lacks guide interrupt capability', () => {
        const deliveryModeRef: MutableRefObject<MessageDeliveryMode> = { current: 'guide' }
        localStorage.setItem('hapi-power-follow-up-behavior', 'guide')

        renderComposer({ deliveryModeRef, guideInterruptSupported: false })

        expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Send guide now' })).not.toBeInTheDocument()
        expect(deliveryModeRef.current).toBe('queue')
    })
})
