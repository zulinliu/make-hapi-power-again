import { useEffect } from 'react'
import { isTelegramApp } from '@/hooks/useTelegram'

/**
 * Sets a CSS custom property `--app-viewport-height` on <html> that tracks the
 * visual viewport height. This is a fallback for browsers that do not support
 * the `interactive-widget=resizes-content` viewport meta attribute — on those
 * browsers `100dvh` does NOT shrink when the virtual keyboard opens, so the
 * composer input is hidden behind the keyboard.
 *
 * iOS PWA (standalone mode) has a known bug where `visualViewport.resize` does
 * not fire reliably when the keyboard is dismissed. We add a `focusout` event
 * fallback on input/textarea/contenteditable elements that forces a delayed
 * viewport recalculation via double rAF.
 *
 * The CSS height chain is:
 *   var(--tg-viewport-stable-height, var(--app-viewport-height, 100dvh))
 *
 * Skipped in Telegram Mini Apps (Telegram SDK provides its own height variable).
 */
export function useViewportHeight(): void {
    useEffect(() => {
        if (isTelegramApp()) return

        const viewport = window.visualViewport
        if (!viewport) return

        const root = document.documentElement
        let mounted = true

        function update() {
            if (!viewport || !mounted) return
            const diff = window.innerHeight - viewport.height
            if (diff > 1) {
                root.style.setProperty('--app-viewport-height', `${viewport.height}px`)
                if (window.scrollY > 0) {
                    window.scrollTo(0, 0)
                }
            } else {
                root.style.removeProperty('--app-viewport-height')
            }
        }

        // iOS PWA fallback: visualViewport.resize may not fire on keyboard dismiss.
        // When an input/textarea/contenteditable loses focus, schedule a delayed
        // update via double rAF to give the layout engine time to recalculate.
        function onFocusOut(event: FocusEvent) {
            const target = event.target as HTMLElement | null
            if (!target) return
            const tag = target.tagName
            if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !target.isContentEditable) return

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (mounted) update()
                })
            })
        }

        viewport.addEventListener('resize', update)
        viewport.addEventListener('scroll', update)
        document.addEventListener('focusout', onFocusOut)

        return () => {
            mounted = false
            viewport.removeEventListener('resize', update)
            viewport.removeEventListener('scroll', update)
            document.removeEventListener('focusout', onFocusOut)
            root.style.removeProperty('--app-viewport-height')
        }
    }, [])
}
