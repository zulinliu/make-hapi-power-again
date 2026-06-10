import * as React from 'react'

export type WindowClass = 'compact' | 'medium' | 'expanded' | 'large' | 'xlarge'
export type InputMode = 'touch' | 'mouse' | 'keyboard' | 'hybrid'
export type ShellMode = 'stack' | 'split' | 'workspace'
export type Density = 'comfortable' | 'compact'

export type SafeAreaInsets = {
    top: number
    right: number
    bottom: number
    left: number
}

export type KeyboardState = {
    visible: boolean
    height: number
}

export type AdaptiveContextValue = {
    windowClass: WindowClass
    inputMode: InputMode
    shellMode: ShellMode
    safeArea: SafeAreaInsets
    keyboardState: KeyboardState
    density: Density
    isCompact: boolean
    isTouch: boolean
}

const DEFAULT_CONTEXT: AdaptiveContextValue = {
    windowClass: 'expanded',
    inputMode: 'mouse',
    shellMode: 'workspace',
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
    keyboardState: { visible: false, height: 0 },
    density: 'compact',
    isCompact: false,
    isTouch: false,
}

const AdaptiveContext = React.createContext<AdaptiveContextValue>(DEFAULT_CONTEXT)

function getWindowClass(width: number): WindowClass {
    if (width < 640) return 'compact'
    if (width < 1024) return 'medium'
    if (width < 1440) return 'expanded'
    if (width < 1920) return 'large'
    return 'xlarge'
}

function getShellMode(windowClass: WindowClass): ShellMode {
    if (windowClass === 'compact' || windowClass === 'medium') return 'stack'
    if (windowClass === 'expanded') return 'split'
    return 'workspace'
}

function getInputMode(): InputMode {
    if (typeof window === 'undefined') return 'mouse'
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const fine = window.matchMedia('(pointer: fine)').matches
    const hover = window.matchMedia('(hover: hover)').matches
    if (coarse && fine) return 'hybrid'
    if (coarse) return 'touch'
    if (fine || hover) return 'mouse'
    return 'keyboard'
}

function readCssPxVariable(name: string): number {
    if (typeof window === 'undefined') return 0
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
}

function readSafeArea(): SafeAreaInsets {
    return {
        top: readCssPxVariable('--hp-safe-area-top'),
        right: readCssPxVariable('--hp-safe-area-right'),
        bottom: readCssPxVariable('--hp-safe-area-bottom'),
        left: readCssPxVariable('--hp-safe-area-left'),
    }
}

function readKeyboardState(): KeyboardState {
    if (typeof window === 'undefined' || !window.visualViewport) {
        return { visible: false, height: 0 }
    }
    const viewport = window.visualViewport
    const height = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
    return {
        visible: height > 80,
        height,
    }
}

function computeContext(): AdaptiveContextValue {
    if (typeof window === 'undefined') return DEFAULT_CONTEXT
    const windowClass = getWindowClass(window.innerWidth)
    const inputMode = getInputMode()
    const shellMode = getShellMode(windowClass)
    const density: Density = windowClass === 'compact' || inputMode === 'touch' ? 'comfortable' : 'compact'
    const isCompact = windowClass === 'compact'
    const isTouch = inputMode === 'touch' || inputMode === 'hybrid'
    return {
        windowClass,
        inputMode,
        shellMode,
        safeArea: readSafeArea(),
        keyboardState: readKeyboardState(),
        density,
        isCompact,
        isTouch,
    }
}

export function AdaptiveProvider({ children }: { children: React.ReactNode }) {
    const [value, setValue] = React.useState<AdaptiveContextValue>(() => computeContext())

    React.useEffect(() => {
        const update = () => setValue(computeContext())
        update()
        window.addEventListener('resize', update)
        window.visualViewport?.addEventListener('resize', update)
        window.visualViewport?.addEventListener('scroll', update)
        const pointerQuery = window.matchMedia('(pointer: coarse)')
        const hoverQuery = window.matchMedia('(hover: hover)')
        pointerQuery.addEventListener('change', update)
        hoverQuery.addEventListener('change', update)
        return () => {
            window.removeEventListener('resize', update)
            window.visualViewport?.removeEventListener('resize', update)
            window.visualViewport?.removeEventListener('scroll', update)
            pointerQuery.removeEventListener('change', update)
            hoverQuery.removeEventListener('change', update)
        }
    }, [])

    React.useEffect(() => {
        document.documentElement.dataset.hpWindowClass = value.windowClass
        document.documentElement.dataset.hpInputMode = value.inputMode
        document.documentElement.dataset.hpShellMode = value.shellMode
        document.documentElement.dataset.hpDensity = value.density
        document.documentElement.dataset.hpKeyboard = value.keyboardState.visible ? 'visible' : 'hidden'
    }, [value])

    return (
        <AdaptiveContext.Provider value={value}>
            {children}
        </AdaptiveContext.Provider>
    )
}

export function useAdaptiveContext(): AdaptiveContextValue {
    return React.useContext(AdaptiveContext)
}
