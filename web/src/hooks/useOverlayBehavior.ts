import { useEffect, useRef, useCallback } from 'react'

/**
 * Detect prefers-reduced-motion media query.
 * Returns true when user prefers reduced motion.
 */
export function useReducedMotion(): boolean {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Lock body scroll when active (e.g. overlay open).
 * Restores on cleanup.
 */
export function useScrollLock(active: boolean): void {
    useEffect(() => {
        if (!active) return
        const originalOverflow = document.body.style.overflow
        const originalOverscroll = document.body.style.overscrollBehavior
        document.body.style.overflow = 'hidden'
        document.body.style.overscrollBehavior = 'none'
        return () => {
            document.body.style.overflow = originalOverflow
            document.body.style.overscrollBehavior = originalOverscroll
        }
    }, [active])
}

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable]',
    'details > summary',
].join(', ')

function getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((el) => {
        // Skip hidden elements
        if (el.offsetWidth === 0 && el.offsetHeight === 0) return false
        // Skip elements inside inert containers
        let parent: HTMLElement | null = el
        while (parent && parent !== container) {
            if (parent.inert) return false
            parent = parent.parentElement
        }
        return true
    })
}

/**
 * Trap focus within a container element when active.
 * Tab/Shift+Tab cycle through focusable elements.
 */
export function useFocusTrap(
    containerRef: React.RefObject<HTMLElement | null>,
    active: boolean,
): void {
    useEffect(() => {
        if (!active) return

        const container = containerRef.current
        if (!container) return

        function handleKeyDown(e: KeyboardEvent) {
            if (e.key !== 'Tab') return

            const el = containerRef.current
            if (!el) return

            const focusable = getFocusableElements(el)
            if (focusable.length === 0) return

            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            const activeEl = document.activeElement

            if (e.shiftKey) {
                if (activeEl === first || !el.contains(activeEl)) {
                    e.preventDefault()
                    last.focus()
                }
            } else {
                if (activeEl === last || !el.contains(activeEl)) {
                    e.preventDefault()
                    first.focus()
                }
            }
        }

        const el = containerRef.current
        if (!el) return
        el.addEventListener('keydown', handleKeyDown)
        return () => el.removeEventListener('keydown', handleKeyDown)
    }, [containerRef, active])
}

/**
 * Save and restore focus when activating/deactivating.
 * Call setTrigger() when the trigger element is focused (before overlay opens).
 * When active becomes false, focus returns to the saved trigger.
 */
export function useFocusReturn(active: boolean): {
    setTrigger: (el: HTMLElement | null) => void
    restoreFocus: () => void
} {
    const triggerRef = useRef<HTMLElement | null>(null)

    const setTrigger = useCallback((el: HTMLElement | null) => {
        triggerRef.current = el
    }, [])

    const restoreFocus = useCallback(() => {
        // Use requestAnimationFrame to avoid focus race with DOM updates
        requestAnimationFrame(() => {
            if (triggerRef.current && triggerRef.current.isConnected) {
                triggerRef.current.focus({ preventScroll: true })
            }
        })
    }, [])

    useEffect(() => {
        if (!active) {
            restoreFocus()
        }
    }, [active, restoreFocus])

    return { setTrigger, restoreFocus }
}

/**
 * Set inert attribute on all siblings of the given container.
 * This makes background content inaccessible to screen readers and keyboard.
 */
export function useInertOthers(
    containerRef: React.RefObject<HTMLElement | null>,
    active: boolean,
): void {
    useEffect(() => {
        if (!active) return

        const container = containerRef.current
        if (!container) return

        const parent = container.parentElement
        if (!parent) return

        const siblings: HTMLElement[] = []
        for (const child of Array.from(parent.children)) {
            if (child !== container && child instanceof HTMLElement) {
                siblings.push(child)
                child.inert = true
            }
        }

        return () => {
            for (const sibling of siblings) {
                sibling.inert = false
            }
        }
    }, [containerRef, active])
}
