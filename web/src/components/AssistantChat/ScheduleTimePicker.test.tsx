import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n-context'
import { ScheduleTimePicker } from './ScheduleTimePicker'

function mockMediaQuery(matches: boolean) {
    const original = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches,
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn()
        }))
    })
    return () => {
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            writable: true,
            value: original
        })
    }
}

describe('ScheduleTimePicker interactions', () => {
    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })

    it('submits the specific datetime when Enter is pressed in the datetime input', () => {
        const anchorRef = { current: document.createElement('button') }
        const onSchedule = vi.fn()
        const onClose = vi.fn()
        const future = new Date(Date.now() + 60 * 60 * 1000)
        const pad = (n: number) => String(n).padStart(2, '0')
        const value = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(future.getMinutes())}`

        const onParentKeyDown = vi.fn()

        render(
            <I18nProvider>
                <div onKeyDown={onParentKeyDown}>
                    <ScheduleTimePicker
                        anchorRef={anchorRef}
                        onSchedule={onSchedule}
                        onClose={onClose}
                        pendingSchedule={null}
                    />
                </div>
            </I18nProvider>
        )

        fireEvent.click(screen.getByRole('button', { name: /specific/i }))
        const input = screen.getByDisplayValue('')
        fireEvent.change(input, { target: { value } })

        const defaultNotPrevented = fireEvent.keyDown(input, { key: 'Enter' })

        expect(defaultNotPrevented).toBe(false)
        expect(onParentKeyDown).not.toHaveBeenCalled()
        expect(onSchedule).toHaveBeenCalledWith({ type: 'absolute', ms: new Date(value).getTime() })
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('positions the mobile picker above the composer anchor', async () => {
        const restoreMatchMedia = mockMediaQuery(true)
        const anchor = document.createElement('button')
        vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
            top: 610,
            right: 370,
            bottom: 654,
            left: 326,
            width: 44,
            height: 44,
            x: 326,
            y: 610,
            toJSON: () => ({})
        } as DOMRect)

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 })

        render(
            <I18nProvider>
                <ScheduleTimePicker
                    anchorRef={{ current: anchor }}
                    onSchedule={vi.fn()}
                    onClose={vi.fn()}
                    pendingSchedule={null}
                />
            </I18nProvider>
        )

        const dialog = screen.getByRole('dialog', { name: /schedule/i })
        await waitFor(() => {
            expect(dialog).toHaveStyle({ position: 'fixed' })
            expect(dialog.style.top).not.toBe('')
            expect(dialog.className).not.toContain('bottom-[')
        })

        restoreMatchMedia()
    })
})
