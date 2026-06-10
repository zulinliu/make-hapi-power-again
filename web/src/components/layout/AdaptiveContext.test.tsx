import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdaptiveProvider, useAdaptiveContext } from './AdaptiveContext'

function Consumer() {
    const adaptive = useAdaptiveContext()
    return (
        <div>
            <div data-testid="window-class">{adaptive.windowClass}</div>
            <div data-testid="shell-mode">{adaptive.shellMode}</div>
            <div data-testid="density">{adaptive.density}</div>
        </div>
    )
}

function setViewport(width: number, height = 900) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
    window.dispatchEvent(new Event('resize'))
}

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

describe('AdaptiveProvider', () => {
    it('classifies compact stack surfaces', () => {
        setViewport(390)
        render(
            <AdaptiveProvider>
                <Consumer />
            </AdaptiveProvider>
        )

        expect(screen.getByTestId('window-class')).toHaveTextContent('compact')
        expect(screen.getByTestId('shell-mode')).toHaveTextContent('stack')
        expect(screen.getByTestId('density')).toHaveTextContent('comfortable')
        expect(document.documentElement.dataset.hpWindowClass).toBe('compact')
    })

    it('classifies expanded split surfaces', () => {
        setViewport(1280)
        render(
            <AdaptiveProvider>
                <Consumer />
            </AdaptiveProvider>
        )

        expect(screen.getByTestId('window-class')).toHaveTextContent('expanded')
        expect(screen.getByTestId('shell-mode')).toHaveTextContent('split')
        expect(document.documentElement.dataset.hpShellMode).toBe('split')
    })
})
