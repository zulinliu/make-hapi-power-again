import { useParams, useNavigate } from '@tanstack/react-router'
import { useAppContext } from '@/lib/app-context'
import { useTranslation } from '@/lib/use-translation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

export default function MobileTerminalPage() {
    const { t } = useTranslation()
    const { sessionId } = useParams({ strict: false }) as { sessionId: string }
    const { api, baseUrl, token } = useAppContext()
    const navigate = useNavigate()
    const terminalRef = useRef<HTMLDivElement>(null)
    const preRef = useRef<HTMLPreElement>(null)
    const [lines, setLines] = useState<string[]>([])
    const [connected, setConnected] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const socketRef = useRef<Socket | null>(null)
    const userScrolledRef = useRef(false)
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (!baseUrl || !token) return

        const socketUrl = baseUrl.replace(/\/$/, '')
        const socket = io(`${socketUrl}/terminal`, {
            auth: { token },
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 3,
        })

        socketRef.current = socket

        socket.on('connect', () => {
            setConnected(true)
            setError(null)
            socket.emit('terminal:create', { sessionId, terminalId: `mobile-${sessionId}` })
        })

        socket.on('terminal:output', (data: string) => {
            if (typeof data === 'string') {
                setLines(prev => {
                    const newLines = data.split('\n')
                    const updated = [...prev, ...newLines]
                    return updated.slice(-500)
                })
            }
        })

        socket.on('terminal:error', (err: string) => {
            setError(typeof err === 'string' ? err : t('terminal.mobile.error'))
        })

        socket.on('terminal:exit', () => {
            setConnected(false)
        })

        socket.on('disconnect', () => setConnected(false))

        socket.on('connect_error', () => {
            setError(t('terminal.mobile.connectFailed'))
            setConnected(false)
        })

        return () => {
            socket.disconnect()
            socketRef.current = null
        }
    }, [baseUrl, token, sessionId])

    const scrollToBottom = useCallback(() => {
        const el = terminalRef.current
        if (!el) return
        el.scrollTop = el.scrollHeight
        userScrolledRef.current = false
    }, [])

    useEffect(() => {
        if (userScrolledRef.current) return
        requestAnimationFrame(() => {
            scrollToBottom()
        })
    }, [lines, scrollToBottom])

    const handleScroll = useCallback(() => {
        const el = terminalRef.current
        if (!el) return
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
        userScrolledRef.current = !atBottom

        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current)
        }
        scrollTimeoutRef.current = setTimeout(() => {
            userScrolledRef.current = false
        }, 5000)
    }, [])

    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
        }
    }, [])

    const textContent = lines.join('\n')

    return (
        <div className="flex flex-col h-[100dvh] bg-gray-950 text-green-400 font-mono">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800 pt-[calc(0.75rem+env(safe-area-inset-top))]">
                <button
                    type="button"
                    onClick={() => navigate({ to: '/sessions' })}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-200">{t('terminal.title')}</div>
                    <div className="text-xs text-gray-500">{t('terminal.mobile.readonly')}</div>
                </div>
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-600'}`} />
            </div>

            {error && (
                <div className="px-4 py-2 bg-red-950 text-red-400 text-xs">{error}</div>
            )}

            {/* Terminal output */}
            <div
                ref={terminalRef}
                onScroll={handleScroll}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3"
                style={{
                    WebkitOverflowScrolling: 'touch',
                    scrollBehavior: 'auto',
                }}
            >
                {lines.length === 0 ? (
                    <div className="text-gray-600 text-xs">{connected ? t('terminal.mobile.waitingOutput') : t('terminal.mobile.connecting')}</div>
                ) : (
                    <pre
                        ref={preRef}
                        className="text-xs leading-5 whitespace-pre-wrap break-all font-mono m-0"
                    >{textContent}</pre>
                )}
            </div>

            {/* Scroll to bottom button */}
            {userScrolledRef.current && lines.length > 0 && (
                <div className="flex justify-center pb-[env(safe-area-inset-bottom)]">
                    <button
                        type="button"
                        onClick={scrollToBottom}
                        className="mb-2 rounded-full bg-gray-800 px-4 py-1.5 text-xs text-gray-300 shadow-lg active:bg-gray-700"
                    >
                        ↓ {t('terminal.scrollToBottom')}
                    </button>
                </div>
            )}
        </div>
    )
}
