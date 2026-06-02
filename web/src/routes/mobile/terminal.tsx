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
    const [lines, setLines] = useState<string[]>([])
    const [connected, setConnected] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const socketRef = useRef<Socket | null>(null)

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
                    return updated.slice(-200)
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

        socket.on('connect_error', (err) => {
            setError(t('terminal.mobile.connectFailed'))
            setConnected(false)
        })

        return () => {
            socket.disconnect()
            socketRef.current = null
        }
    }, [baseUrl, token, sessionId])

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight
        }
    }, [lines])

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
            <div ref={terminalRef} className="flex-1 min-h-0 overflow-y-auto p-3 text-xs leading-5">
                {lines.length === 0 ? (
                    <div className="text-gray-600">{connected ? t('terminal.mobile.waitingOutput') : t('terminal.mobile.connecting')}</div>
                ) : (
                    lines.map((line, i) => (
                        <div key={i} className="whitespace-pre-wrap break-all min-h-[1.25rem]">
                            {line || ' '}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
