import type React from 'react'
import { useCallback, useRef, useState } from 'react'

type UseLongPressOptions = {
    onLongPress: (point: { x: number; y: number }) => void
    onClick?: () => void
    threshold?: number
    disabled?: boolean
    /** Called when the press state changes (active/inactive) for visual feedback */
    onPressStateChange?: (pressed: boolean) => void
}

type UseLongPressHandlers = {
    onMouseDown: React.MouseEventHandler
    onMouseUp: React.MouseEventHandler
    onMouseLeave: React.MouseEventHandler
    onTouchStart: React.TouchEventHandler
    onTouchEnd: React.TouchEventHandler
    onTouchMove: React.TouchEventHandler
    onContextMenu: React.MouseEventHandler
    onKeyDown: React.KeyboardEventHandler
}

type UseLongPressResult = UseLongPressHandlers & {
    /** Whether the element is currently in a long-pressed visual state */
    isLongPressed: boolean
}

export function useLongPress(options: UseLongPressOptions): UseLongPressResult {
    const { onLongPress, onClick, threshold = 500, disabled = false, onPressStateChange } = options

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isLongPressRef = useRef(false)
    const touchMoved = useRef(false)
    const pressPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
    const isTouchingRef = useRef(false)
    const [isLongPressed, setIsLongPressed] = useState(false)

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
    }, [])

    const startTimer = useCallback((clientX: number, clientY: number) => {
        if (disabled) return

        clearTimer()
        isLongPressRef.current = false
        touchMoved.current = false
        pressPointRef.current = { x: clientX, y: clientY }

        timerRef.current = setTimeout(() => {
            isLongPressRef.current = true
            setIsLongPressed(true)
            onPressStateChange?.(true)
            // Clear any text selection triggered by iOS during the long press hold
            const selection = window.getSelection()
            if (selection && selection.toString().length > 0) {
                selection.removeAllRanges()
            }
            onLongPress(pressPointRef.current)
        }, threshold)
    }, [disabled, clearTimer, onLongPress, onPressStateChange, threshold])

    const handleEnd = useCallback((shouldTriggerClick: boolean) => {
        clearTimer()

        if (shouldTriggerClick && !isLongPressRef.current && !touchMoved.current && onClick) {
            onClick()
        }

        if (isLongPressRef.current) {
            setIsLongPressed(false)
            onPressStateChange?.(false)
        }

        isLongPressRef.current = false
        touchMoved.current = false
    }, [clearTimer, onClick, onPressStateChange])

    const onMouseDown = useCallback<React.MouseEventHandler>((e) => {
        // Ignore mouse events after a touch interaction to prevent double-firing
        if (isTouchingRef.current) return
        if (e.button !== 0) return
        startTimer(e.clientX, e.clientY)
    }, [startTimer])

    const onMouseUp = useCallback<React.MouseEventHandler>(() => {
        if (isTouchingRef.current) return
        handleEnd(!isLongPressRef.current)
    }, [handleEnd])

    const onMouseLeave = useCallback<React.MouseEventHandler>(() => {
        if (isTouchingRef.current) return
        handleEnd(false)
    }, [handleEnd])

    const onTouchStart = useCallback<React.TouchEventHandler>((e) => {
        isTouchingRef.current = true
        const touch = e.touches[0]
        startTimer(touch.clientX, touch.clientY)
    }, [startTimer])

    const onTouchEnd = useCallback<React.TouchEventHandler>((e) => {
        if (isLongPressRef.current) {
            e.preventDefault()
        }
        handleEnd(!isLongPressRef.current)
        // Reset after a short delay to allow any synthetic mouse events to be ignored
        setTimeout(() => { isTouchingRef.current = false }, 400)
    }, [handleEnd])

    const onTouchMove = useCallback<React.TouchEventHandler>((e) => {
        const touch = e.touches[0]
        const dx = touch.clientX - pressPointRef.current.x
        const dy = touch.clientY - pressPointRef.current.y
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
            touchMoved.current = true
            clearTimer()
        }
    }, [clearTimer])

    const onContextMenu = useCallback<React.MouseEventHandler>((e) => {
        if (!disabled) {
            e.preventDefault()
            clearTimer()
            isLongPressRef.current = true
            onLongPress({ x: e.clientX, y: e.clientY })
        }
    }, [disabled, clearTimer, onLongPress])

    const onKeyDown = useCallback<React.KeyboardEventHandler>((e) => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick?.()
        }
    }, [disabled, onClick])

    return {
        onMouseDown,
        onMouseUp,
        onMouseLeave,
        onTouchStart,
        onTouchEnd,
        onTouchMove,
        onContextMenu,
        onKeyDown,
        isLongPressed
    }
}
