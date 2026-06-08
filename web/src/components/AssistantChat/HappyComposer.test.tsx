import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ButtonHTMLAttributes, FormEventHandler, ReactNode, TextareaHTMLAttributes } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n-context'
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

function renderComposer() {
    return render(
        <I18nProvider>
            <HappyComposer
                sessionId="session-A"
                active={true}
                thinking={true}
                agentState={null}
                agentFlavor="codex"
            />
        </I18nProvider>
    )
}

describe('HappyComposer Guide delivery mode control', () => {
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

    it('supports roving keyboard selection for queue and guide modes', async () => {
        renderComposer()

        const queue = screen.getByRole('radio', { name: 'Queue' })
        const guide = screen.getByRole('radio', { name: 'Guide now' })

        expect(queue).toHaveAttribute('aria-checked', 'true')
        expect(queue).toHaveAttribute('tabindex', '0')
        expect(guide).toHaveAttribute('aria-checked', 'false')
        expect(guide).toHaveAttribute('tabindex', '-1')

        fireEvent.keyDown(queue, { key: 'ArrowRight' })
        await waitFor(() => {
            expect(guide).toHaveAttribute('aria-checked', 'true')
            expect(guide).toHaveFocus()
        })

        fireEvent.keyDown(guide, { key: 'ArrowLeft' })
        await waitFor(() => {
            expect(queue).toHaveAttribute('aria-checked', 'true')
            expect(queue).toHaveFocus()
        })

        fireEvent.keyDown(queue, { key: 'End' })
        await waitFor(() => {
            expect(guide).toHaveAttribute('aria-checked', 'true')
        })

        fireEvent.keyDown(guide, { key: 'Home' })
        await waitFor(() => {
            expect(queue).toHaveAttribute('aria-checked', 'true')
        })

        fireEvent.keyDown(queue, { key: 'Enter' })
        await waitFor(() => {
            expect(queue).toHaveAttribute('aria-checked', 'true')
        })

        fireEvent.keyDown(queue, { key: ' ' })
        await waitFor(() => {
            expect(queue).toHaveAttribute('aria-checked', 'true')
        })
    })
})
